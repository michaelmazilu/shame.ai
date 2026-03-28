// background.js — Service worker for ShotTaker
// Manages persistent state: shot history, seen profiles, rate limits, pending follow-backs

const PENDING_TIMEOUT_MS = 48 * 60 * 60 * 1000; // 48 hours
const MAX_DM_RETRIES = 3;

// ── Install & Startup ──

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ShotTaker] Extension installed");

  chrome.storage.local.get(["st_settings"], (data) => {
    if (!data.st_settings) {
      chrome.storage.local.set({
        st_settings: {
          enabled: true,
          dmTemplate:
            "Hey — I came across your profile and wanted to say hello.",
          maxDMsPerHour: 10,
          sources: { suggested: true, explore: true, friendsOfFriends: true },
        },
        st_seen: [],
        st_shot_history: [],
        st_dms_hour: 0,
        st_dms_reset: Date.now(),
        st_pending_follows: [],
      });
    } else {
      // Ensure pending key exists on upgrade
      chrome.storage.local.get(["st_pending_follows"], (d) => {
        if (!d.st_pending_follows) {
          chrome.storage.local.set({ st_pending_follows: [] });
        }
      });
    }
  });

  // Set up 5-minute polling alarm
  chrome.alarms.create("st_check_pending", { periodInMinutes: 5 });
});

chrome.runtime.onStartup.addListener(() => {
  // Recreate alarm on browser restart
  chrome.alarms.create("st_check_pending", { periodInMinutes: 5 });
});

// ── Alarm Handler ──

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "st_check_pending") {
    processPendingFollows();
  }
});

// ── Message Handlers ──

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Record a sent shot in history
  if (msg.type === "ST_SHOT_SENT") {
    chrome.storage.local.get(["st_shot_history"], (data) => {
      const history = data.st_shot_history || [];
      history.unshift({
        profile: msg.profile,
        timestamp: msg.timestamp,
      });

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
    return true;
  }

  // Reset all data
  if (msg.type === "ST_RESET") {
    chrome.storage.local.set({
      st_seen: [],
      st_shot_history: [],
      st_dms_hour: 0,
      st_dms_reset: Date.now(),
      st_pending_follows: [],
    });
    sendResponse({ ok: true });
  }

  // Add a pending follow-back to track
  if (msg.type === "ST_ADD_PENDING") {
    chrome.storage.local.get(["st_pending_follows"], (data) => {
      const pending = data.st_pending_follows || [];

      // Avoid duplicates
      if (pending.some((p) => p.userId === msg.userId)) {
        sendResponse({ ok: true, duplicate: true });
        return;
      }

      pending.push({
        userId: msg.userId,
        username: msg.username,
        fullName: msg.fullName,
        followedAt: Date.now(),
        dmTemplate: msg.dmTemplate,
        status: "pending",
        retries: 0,
      });

      chrome.storage.local.set({ st_pending_follows: pending });
      console.log(`[ShotTaker] Tracking pending follow-back: @${msg.username}`);
      sendResponse({ ok: true });
    });
    return true;
  }

  // Get pending follows list
  if (msg.type === "ST_GET_PENDING") {
    chrome.storage.local.get(["st_pending_follows"], (data) => {
      sendResponse({ pending: data.st_pending_follows || [] });
    });
    return true;
  }

  // Manual trigger for pending check
  if (msg.type === "ST_CHECK_PENDING") {
    processPendingFollows();
    sendResponse({ ok: true });
  }

  // Generate a personalized DM via Azure OpenAI
  if (msg.type === "ST_GENERATE_MESSAGE") {
    (async () => {
      try {
        const data = await chromeStorageGet(["st_settings"]);
        const s = data.st_settings || {};
        const tone = s.aiTone || "casual";

        const text = await generateMessage(tone);
        sendResponse({ ok: true, message: text });
      } catch (e) {
        console.error("[ShotTaker] AI generation failed:", e);
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }
});

// ── Pending Follow-Back Processing ──

async function processPendingFollows() {
  const data = await chromeStorageGet([
    "st_pending_follows",
    "st_shot_history",
  ]);
  const pending = data.st_pending_follows || [];
  const history = data.st_shot_history || [];

  const active = pending.filter((p) => p.status === "pending");
  if (active.length === 0) return;

  console.log(`[ShotTaker] Checking ${active.length} pending follow-backs`);

  // Find an Instagram tab to delegate API calls to
  const tab = await findInstagramTab();
  if (!tab) {
    console.log("[ShotTaker] No Instagram tab open — skipping poll");
    return;
  }

  const now = Date.now();

  for (const entry of active) {
    // Check timeout (48h)
    if (now - entry.followedAt > PENDING_TIMEOUT_MS) {
      console.log(`[ShotTaker] @${entry.username} timed out — unfollowing`);
      await sendTabMessage(tab.id, {
        type: "ST_EXEC_UNFOLLOW",
        userId: entry.userId,
      });
      entry.status = "expired";
      continue;
    }

    // Check if they followed back
    const result = await sendTabMessage(tab.id, {
      type: "ST_EXEC_CHECK_FOLLOWS",
      userId: entry.userId,
    });

    if (result?.followedBy) {
      console.log(
        `[ShotTaker] @${entry.username} followed back! Sending DM...`,
      );

      const dmResult = await sendTabMessage(tab.id, {
        type: "ST_EXEC_SEND_DM",
        userId: entry.userId,
        text: entry.dmTemplate,
      });

      if (dmResult?.success) {
        entry.status = "sent";
        // Add to shot history
        history.unshift({
          profile: {
            id: entry.userId,
            username: entry.username,
            fullName: entry.fullName,
          },
          timestamp: now,
        });
        if (history.length > 500) history.length = 500;
        console.log(`[ShotTaker] Message sent to @${entry.username}`);
      } else {
        entry.retries = (entry.retries || 0) + 1;
        console.warn(
          `[ShotTaker] DM to @${entry.username} failed (retry ${entry.retries}/${MAX_DM_RETRIES})`,
        );
        if (entry.retries >= MAX_DM_RETRIES) {
          entry.status = "expired";
          await sendTabMessage(tab.id, {
            type: "ST_EXEC_UNFOLLOW",
            userId: entry.userId,
          });
        }
      }
    }
  }

  // Save updated state
  await chromeStorageSet({
    st_pending_follows: pending,
    st_shot_history: history,
  });

  // Clean up old completed/expired entries (older than 7 days)
  const cleanupThreshold = now - 7 * 24 * 60 * 60 * 1000;
  const cleaned = pending.filter(
    (p) => p.status === "pending" || p.followedAt > cleanupThreshold,
  );
  if (cleaned.length !== pending.length) {
    await chromeStorageSet({ st_pending_follows: cleaned });
  }
}

// ── Azure OpenAI Message Generation ──

importScripts("secrets.js");

const TONE_PROMPTS = {
  casual:
    "Tone: chill and low-key. Like you're texting someone you vaguely know. No pressure.",
  flirty:
    "Tone: subtly confident. A little playful, never desperate or cheesy.",
  witty:
    "Tone: dry humor or a clever observation. Not trying too hard to be funny.",
  professional:
    "Tone: warm but professional. Like a friendly LinkedIn message, not corporate.",
};

async function generateMessage(tone) {
  const toneGuide = TONE_PROMPTS[tone] || TONE_PROMPTS.casual;

  const resp = await fetch(AZURE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": AZURE_API_KEY,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: [
            "You generate very short Instagram DM openers.",
            toneGuide,
            "Hard rules:",
            "- ONE sentence only. Keep it under 15 words.",
            "- No emojis. No exclamation marks.",
            "- Never compliment their appearance or say you 'came across their profile'.",
            "- Never use pickup lines, puns, or anything that sounds rehearsed.",
            "- Don't be pushy, overly personal, or weirdly intimate with a stranger.",
            "- Sound like a real person, not a bot. Be brief and natural.",
            "- Output ONLY the message. No quotes, no labels, nothing else.",
          ].join("\n"),
        },
        {
          role: "user",
          content: "Write one short DM opener.",
        },
      ],
      max_tokens: 60,
      temperature: 0.9,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Azure API ${resp.status}: ${body}`);
  }

  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from Azure API");
  return text;
}

// ── Helpers ──

function findInstagramTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "*://*.instagram.com/*" }, (tabs) => {
      resolve(tabs?.[0] || null);
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "[ShotTaker] Tab message failed:",
          chrome.runtime.lastError.message,
        );
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

function chromeStorageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function chromeStorageSet(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}
