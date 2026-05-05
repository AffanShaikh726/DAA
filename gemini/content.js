const activeScans = new Set();

class RabinKarpScanner {
    constructor(base = 256, prime = 101) {
        this.base = base;
        this.prime = prime;
    }
    calculateHash(str, length) {
        let hash = 0;
        for (let i = 0; i < length; i++)
            hash = (this.base * hash + str.charCodeAt(i)) % this.prime;
        return hash;
    }
    search(text, pattern) {
        const n = text.length,
            m = pattern.length;
        if (m > n || m === 0) return false;
        let pHash = this.calculateHash(pattern, m);
        let tHash = this.calculateHash(text.substring(0, m), m);
        let h = 1;
        for (let i = 0; i < m - 1; i++) h = (h * this.base) % this.prime;
        for (let i = 0; i <= n - m; i++) {
            if (pHash === tHash && text.substring(i, i + m) === pattern)
                return true;
            if (i < n - m) {
                tHash =
                    (this.base * (tHash - text.charCodeAt(i) * h) +
                        text.charCodeAt(i + m)) %
                    this.prime;
                if (tHash < 0) tHash += this.prime;
            }
        }
        return false;
    }
}

const scanner = new RabinKarpScanner();

const DEFAULT_KEYWORDS = {
    high: {
        words: [
            "exam",
            "midterm",
            "final",
            "viva",
            "quiz",
            "test",
            "deadline",
            "due today",
            "last date",
            "submit by",
            "submission deadline",
            "final submission",
            "urgent submission",
            "assignment due",
            "project submission",
            "internal marks",
            "marks published",
            "result declared",
            "grade submission",
            "evaluation",
            "attendance shortage",
            "detained",
            "hall ticket",
            "admit card",
            "deadline tomorrow",
            "deadline reminder",
        ],
        weight: 45,
    },
    medium: {
        words: [
            "assignment",
            "project",
            "lab",
            "record submission",
            "class test",
            "unit test",
            "schedule",
            "timetable",
            "rescheduled",
            "class cancelled",
            "class postponed",
            "presentation",
            "ppt submission",
            "group project",
            "review meeting",
            "discussion",
            "course update",
            "syllabus",
            "lecture update",
            "important notice",
            "announcement",
            "deadline extended",
        ],
        weight: 25,
    },
    low: {
        words: [
            "seminar",
            "webinar",
            "workshop",
            "event",
            "club activity",
            "guest lecture",
            "orientation",
            "training session",
            "internship",
            "internship opportunity",
            "placement",
            "placement talk",
            "career guidance",
            "competition",
            "hackathon",
            "volunteer",
            "circular",
            "newsletter",
        ],
        weight: 10,
    },
};

const COMBOS = [
    { keys: ["exam", "timetable"], bonus: 20 },
    { keys: ["deadline", "submission"], bonus: 25 },
    { keys: ["assignment", "due"], bonus: 15 },
    { keys: ["project", "submission"], bonus: 20 },
    { keys: ["marks", "published"], bonus: 20 },
];

async function analyze(text) {
    const storage = await chrome.storage.local.get("customKeywords");
    const userKW = storage.customKeywords || {
        high: { words: [] },
        medium: { words: [] },
        low: { words: [] },
    };

    const KEYWORDS = {
        high: {
            words: [
                ...DEFAULT_KEYWORDS.high.words,
                ...(userKW.high?.words || []),
            ],
            weight: 45,
        },
        medium: {
            words: [
                ...DEFAULT_KEYWORDS.medium.words,
                ...(userKW.medium?.words || []),
            ],
            weight: 25,
        },
        low: {
            words: [
                ...DEFAULT_KEYWORDS.low.words,
                ...(userKW.low?.words || []),
            ],
            weight: 10,
        },
    };

    let score = 0;
    let clean = text.toLowerCase();
    let foundWords = new Set();

    for (const level in KEYWORDS) {
        for (const word of KEYWORDS[level].words) {
            if (scanner.search(clean, word)) {
                score += KEYWORDS[level].weight;
                foundWords.add(word);
            }
        }
    }

    COMBOS.forEach((combo) => {
        const isComboMatch = combo.keys.every(
            (key) => foundWords.has(key) || scanner.search(clean, key),
        );
        if (isComboMatch) score += combo.bonus;
    });

    if (score >= 70) return { label: "Urgent", class: "p-urgent" };
    if (score >= 25) return { label: "Important", class: "p-important" };
    return { label: "Normal", class: "p-normal" };
}

async function processInbox() {
    const rows = document.querySelectorAll("tr.zA");

    for (const row of rows) {
        // 1. SELECT CONTENT: Targeted selectors for Sender and Subject
        // Added .zF and [email] as they are common for Uni accounts
        const senderNode = row.querySelector(".yP, .zF, .bA4, [email]");
        const subjectNode = row.querySelector(".bog, .y6");

        if (!subjectNode) continue;

        const senderText = senderNode ? senderNode.innerText : "";
        const subjectText = subjectNode.innerText;
        const fullText = `${senderText} ${subjectText}`;

        // 2. CREATE UNIQUE SIGNATURE
        const contentSignature = fullText.replace(/\s/g, "");

        // 3. CHECK EXISTING STATE
        const existingBadge = row.querySelector(".academic-badge");
        const lastScannedSignature = row.getAttribute("data-last-signature");

        if (existingBadge && lastScannedSignature === contentSignature)
            continue;
        if (existingBadge && lastScannedSignature !== contentSignature)
            existingBadge.remove();

        // 4. LOCKING
        if (activeScans.has(contentSignature)) continue;
        activeScans.add(contentSignature);

        try {
            // Pass the COMBINED text to Rabin-Karp
            const res = await analyze(fullText);

            if (!row.querySelector(".academic-badge")) {
                const badge = document.createElement("span");
                badge.className = `academic-badge ${res.class}`;
                badge.innerText = res.label;

                const target =
                    row.querySelector(".yX") || subjectNode.parentElement;
                if (target) {
                    target.prepend(badge);
                    row.setAttribute("data-last-signature", contentSignature);
                }
            }
        } catch (err) {
            console.error("Scan error:", err);
        } finally {
            setTimeout(() => activeScans.delete(contentSignature), 300);
        }
    }
}

// Initialization and Observers
let isProcessing = false;
const observer = new MutationObserver(() => {
    if (isProcessing) return;
    isProcessing = true;
    setTimeout(() => {
        processInbox().then(() => {
            isProcessing = false;
        });
    }, 250);
});

const targetNode = document.querySelector(".bkK") || document.body;
observer.observe(targetNode, { childList: true, subtree: true });

let lastUrl = location.href;
const navObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (
            lastUrl.includes("#inbox") ||
            lastUrl.includes("#all") ||
            lastUrl.includes("#priority")
        ) {
            document
                .querySelectorAll("tr.zA")
                .forEach((row) => row.removeAttribute("data-last-signature"));
            processInbox();
        }
    }
});
navObserver.observe(document, { subtree: true, childList: true });

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "REFRESH_LABELS") {
        activeScans.clear();
        document.querySelectorAll(".academic-badge").forEach((b) => b.remove());
        document
            .querySelectorAll("tr.zA")
            .forEach((row) => row.removeAttribute("data-last-signature"));
        processInbox();
    }
});
