// popup.js — Settings popup logic

document.addEventListener("DOMContentLoaded", async () => {
  const toggleEnabled = document.getElementById("toggle-enabled");
  const dmTemplate = document.getElementById("dm-template");
  const maxDMs = document.getElementById("max-dms");
  const sourceSuggested = document.getElementById("source-suggested");
  const sourceExplore = document.getElementById("source-explore");
  const sourceFof = document.getElementById("source-fof");
  const historyList = document.getElementById("history-list");
  const statShots = document.getElementById("stat-shots");
  const statSeen = document.getElementById("stat-seen");
  const btnReset = document.getElementById("btn-reset");

  // Load current settings
  chrome.storage.local.get(["st_settings", "st_seen"], (data) => {
    const s = data.st_settings || {};
    toggleEnabled.checked = s.enabled !== false;
    dmTemplate.value =
      s.dmTemplate || "Hey! I came across your profile and had to say hi 👋";
    maxDMs.value = s.maxDMsPerHour || 10;
    sourceSuggested.checked = s.sources?.suggested !== false;
    sourceExplore.checked = s.sources?.explore !== false;
    sourceFof.checked = s.sources?.friendsOfFriends !== false;

    statSeen.textContent = (data.st_seen || []).length;
  });

  // Load shot history
  chrome.runtime.sendMessage({ type: "ST_GET_HISTORY" }, (resp) => {
    const history = resp?.history || [];
    statShots.textContent = history.length;

    if (history.length === 0) return;

    historyList.innerHTML = "";
    for (const entry of history.slice(0, 20)) {
      const item = document.createElement("div");
      item.className = "history-item";
      const time = new Date(entry.timestamp);
      const timeStr = time.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      item.innerHTML = `
        <span class="history-username">@${entry.profile.username}</span>
        <span class="history-time">${timeStr}</span>
      `;
      historyList.appendChild(item);
    }
  });

  // Save settings on change
  function saveSettings() {
    const settings = {
      enabled: toggleEnabled.checked,
      dmTemplate: dmTemplate.value,
      maxDMsPerHour: parseInt(maxDMs.value) || 10,
      sources: {
        suggested: sourceSuggested.checked,
        explore: sourceExplore.checked,
        friendsOfFriends: sourceFof.checked,
      },
    };

    chrome.storage.local.set({ st_settings: settings });

    // Notify content script
    chrome.tabs.query(
      { active: true, currentWindow: true, url: "*://*.instagram.com/*" },
      (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "ST_SETTINGS_UPDATE",
            settings,
          });
        }
      },
    );
  }

  // Toggle enabled state
  toggleEnabled.addEventListener("change", () => {
    saveSettings();
    chrome.tabs.query(
      { active: true, currentWindow: true, url: "*://*.instagram.com/*" },
      (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "ST_TOGGLE",
            enabled: toggleEnabled.checked,
          });
        }
      },
    );
  });

  dmTemplate.addEventListener("input", saveSettings);
  maxDMs.addEventListener("change", saveSettings);
  sourceSuggested.addEventListener("change", saveSettings);
  sourceExplore.addEventListener("change", saveSettings);
  sourceFof.addEventListener("change", saveSettings);

  // Reset button
  btnReset.addEventListener("click", () => {
    if (
      confirm(
        "Reset all ShotTaker data? This clears your swipe history and seen profiles.",
      )
    ) {
      chrome.runtime.sendMessage({ type: "ST_RESET" }, () => {
        statShots.textContent = "0";
        statSeen.textContent = "0";
        historyList.innerHTML = `<div class="history-item" style="color: #8e8e8e; text-align: center;">No shots fired yet</div>`;
      });
    }
  });
});
