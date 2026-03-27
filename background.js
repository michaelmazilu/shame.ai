// background.js — Service worker for ShotTaker
// Manages persistent state: shot history, seen profiles, rate limits

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ShotTaker] Extension installed");

  // Initialize storage with defaults
  chrome.storage.local.get(["st_settings"], (data) => {
    if (!data.st_settings) {
      chrome.storage.local.set({
        st_settings: {
          enabled: true,
          dmTemplate: "Hey! I came across your profile and had to say hi 👋",
          maxDMsPerHour: 10,
          sources: { suggested: true, explore: true, friendsOfFriends: true },
        },
        st_seen: [],
        st_shot_history: [],
        st_dms_hour: 0,
        st_dms_reset: Date.now(),
      });
    }
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Record a sent shot in history
  if (msg.type === "ST_SHOT_SENT") {
    chrome.storage.local.get(["st_shot_history"], (data) => {
      const history = data.st_shot_history || [];
      history.unshift({
        profile: msg.profile,
        timestamp: msg.timestamp,
      });

      // Keep last 500 entries
      if (history.length > 500) history.length = 500;

      chrome.storage.local.set({ st_shot_history: history });
    });
    sendResponse({ ok: true });
  }

  // Get shot history for popup
  if (msg.type === "ST_GET_HISTORY") {
    chrome.storage.local.get(["st_shot_history"], (data) => {
      sendResponse({ history: data.st_shot_history || [] });
    });
    return true; // Keep channel open for async response
  }

  // Reset all data
  if (msg.type === "ST_RESET") {
    chrome.storage.local.set({
      st_seen: [],
      st_shot_history: [],
      st_dms_hour: 0,
      st_dms_reset: Date.now(),
    });
    sendResponse({ ok: true });
  }
});
