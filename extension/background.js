// Background service worker -- manages state across tabs

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_SWIPE_HISTORY") {
    chrome.storage.local.get(["swipeHistory"], (result) => {
      sendResponse(result.swipeHistory || { liked: [], passed: [] });
    });
    return true;
  }

  if (msg.type === "SAVE_SWIPE") {
    chrome.storage.local.get(["swipeHistory"], (result) => {
      const history = result.swipeHistory || { liked: [], passed: [] };
      if (msg.direction === "right") {
        history.liked.push(msg.userId);
      } else {
        history.passed.push(msg.userId);
      }
      chrome.storage.local.set({ swipeHistory: history }, () => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }
});
