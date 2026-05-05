// Helper to notify Gmail tab to re-scan immediately
function notifyGmail() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url.includes("mail.google.com")) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "REFRESH_LABELS" });
        }
    });
}

function updateUI() {
    chrome.storage.local.get("customKeywords", (data) => {
        const list = document.getElementById("keywordList");
        if (!list) return;

        list.innerHTML = "";
        const kw = data.customKeywords || {};
        let hasKeywords = false;
        const levels = ["high", "medium", "low"];

        levels.forEach((level) => {
            if (kw[level] && Array.isArray(kw[level].words)) {
                kw[level].words.forEach((word) => {
                    hasKeywords = true;
                    const item = document.createElement("div");
                    item.className = "kw-item";
                    item.innerHTML = `
                        <div class="kw-info">
                            <span class="kw-tag tag-${level}">${level}</span>
                            <span class="kw-text">${word}</span>
                        </div>
                        <button class="delete-btn" data-word="${word}" data-level="${level}">Remove</button>
                    `;
                    list.appendChild(item);
                });
            }
        });

        if (!hasKeywords) {
            list.innerHTML =
                '<div style="text-align:center; color:#999; padding:20px; font-size:12px;">No custom keywords yet.</div>';
        }
        attachDeleteListeners();
    });
}

function attachDeleteListeners() {
    document.querySelectorAll(".delete-btn").forEach((btn) => {
        btn.onclick = (e) => {
            const word = e.target.getAttribute("data-word");
            const level = e.target.getAttribute("data-level");
            removeKeyword(word, level);
        };
    });
}

document.getElementById("saveBtn").onclick = () => {
    const wordInput = document.getElementById("newWord");
    const word = wordInput.value.trim().toLowerCase();
    const level = document.getElementById("priorityLevel").value;

    if (!word) return;

    chrome.storage.local.get("customKeywords", (data) => {
        let kw = data.customKeywords || {
            high: { words: [], weight: 45 },
            medium: { words: [], weight: 25 },
            low: { words: [], weight: 10 },
        };

        if (!kw[level].words.includes(word)) {
            kw[level].words.push(word);
            chrome.storage.local.set({ customKeywords: kw }, () => {
                wordInput.value = "";
                updateUI();
                notifyGmail(); // Trigger instant refresh
            });
        }
    });
};

function removeKeyword(wordToRemove, level) {
    chrome.storage.local.get("customKeywords", (data) => {
        let kw = data.customKeywords;
        if (kw && kw[level]) {
            kw[level].words = kw[level].words.filter((w) => w !== wordToRemove);
            chrome.storage.local.set({ customKeywords: kw }, () => {
                updateUI();
                notifyGmail(); // Trigger instant refresh
            });
        }
    });
}

updateUI();
