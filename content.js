// content.js — Main orchestrator
// Injects interceptor into page context, listens for data, manages the swipe UI

(async function () {
  "use strict";

  // ── Inject interceptor into page context ──
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("interceptor.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // ── State ──
  let settings = {
    enabled: true,
    dmTemplate: "Hey! I came across your profile and had to say hi 👋",
    maxDMsPerHour: 10,
    sources: { suggested: true, explore: true, friendsOfFriends: true },
  };

  let seenProfiles = new Set();
  let dmsSentThisHour = 0;
  let isLoading = false;
  let currentUserId = null;

  // ── Load persisted state ──
  async function loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["st_settings", "st_seen", "st_dms_hour", "st_dms_reset"],
        (data) => {
          if (data.st_settings) settings = { ...settings, ...data.st_settings };
          if (data.st_seen) seenProfiles = new Set(data.st_seen);

          const now = Date.now();
          if (data.st_dms_reset && now - data.st_dms_reset > 3600000) {
            dmsSentThisHour = 0;
            chrome.storage.local.set({ st_dms_hour: 0, st_dms_reset: now });
          } else {
            dmsSentThisHour = data.st_dms_hour || 0;
          }
          resolve();
        },
      );
    });
  }

  function saveSeenProfiles() {
    chrome.storage.local.set({ st_seen: [...seenProfiles] });
  }

  function incrementDMCounter() {
    dmsSentThisHour++;
    chrome.storage.local.set({
      st_dms_hour: dmsSentThisHour,
      st_dms_reset: Date.now(),
    });
  }

  // ── Listen for intercepted API data and tokens ──
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data?.type === "ST_TOKENS") {
      InstagramAPI.setGraphQLTokens(event.data.payload);
      return;
    }

    if (event.data?.type !== "ST_DATA") return;

    const { subtype, payload } = event.data;
    console.log(`[ShotTaker] Intercepted: ${subtype}`);
  });

  // ── Listen for messages from popup AND background ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Settings updates from popup
    if (msg.type === "ST_SETTINGS_UPDATE") {
      settings = { ...settings, ...msg.settings };
      chrome.storage.local.set({ st_settings: settings });
      sendResponse({ ok: true });
    }

    if (msg.type === "ST_TOGGLE") {
      settings.enabled = msg.enabled;
      chrome.storage.local.set({ st_settings: settings });
      const container = document.getElementById("shottaker-container");
      if (container) {
        container.style.display = settings.enabled ? "flex" : "none";
      }
      sendResponse({ ok: true });
    }

    if (msg.type === "ST_GET_STATUS") {
      sendResponse({
        enabled: settings.enabled,
        dmsSent: dmsSentThisHour,
        profilesSeen: seenProfiles.size,
        queueSize: 0,
      });
    }

    // ── Background-delegated API calls ──

    if (msg.type === "ST_EXEC_CHECK_FOLLOWS") {
      (async () => {
        try {
          const result = await InstagramAPI.checkRelationship(msg.userId);
          sendResponse(result);
        } catch (e) {
          console.error("[ShotTaker] checkRelationship error:", e);
          sendResponse({ followedBy: false, following: false, error: true });
        }
      })();
      return true;
    }

    if (msg.type === "ST_EXEC_SEND_DM") {
      (async () => {
        try {
          const result = await InstagramAPI.sendDMGraphQL(msg.userId, msg.text);
          if (result.success) incrementDMCounter();
          sendResponse({ success: result.success });
        } catch (e) {
          console.error("[ShotTaker] sendDM error:", e);
          sendResponse({ success: false, error: true });
        }
      })();
      return true;
    }

    if (msg.type === "ST_EXEC_UNFOLLOW") {
      (async () => {
        try {
          const result = await InstagramAPI.unfollowUser(msg.userId);
          sendResponse({ success: result.success });
        } catch (e) {
          console.error("[ShotTaker] unfollow error:", e);
          sendResponse({ success: false, error: true });
        }
      })();
      return true;
    }
  });

  // ── Swipe callbacks ──

  async function onSwipeRight(profile) {
    console.log(`[ShotTaker] Shot fired at @${profile.username}!`);

    // Check DM rate limit
    if (dmsSentThisHour >= settings.maxDMsPerHour) {
      SwipeUI.showStatus(
        `Rate limit: ${settings.maxDMsPerHour} DMs/hour reached`,
        "error",
      );
      return;
    }

    // Mark as seen
    seenProfiles.add(profile.id);
    saveSeenProfiles();

    try {
      // Check if they follow us
      SwipeUI.showStatus("Checking relationship...", "info");
      const relationship = await InstagramAPI.checkRelationship(profile.id);

      if (relationship.followedBy) {
        // They follow us — send DM immediately
        SwipeUI.showStatus("Sending your shot...", "info");

        const result = await InstagramAPI.sendDMGraphQL(
          profile.id,
          settings.dmTemplate,
        );

        if (result.success) {
          incrementDMCounter();
          SwipeUI.showStatus(
            `Shot sent to @${profile.username}! 💘`,
            "success",
          );

          chrome.runtime.sendMessage({
            type: "ST_SHOT_SENT",
            profile: {
              id: profile.id,
              username: profile.username,
              fullName: profile.fullName,
            },
            timestamp: Date.now(),
          });
        } else {
          SwipeUI.showStatus("Failed to send — try again later", "error");
        }
      } else {
        // They don't follow us — follow them and queue for later DM
        SwipeUI.showStatus(`Following @${profile.username}...`, "info");

        const followResult = await InstagramAPI.followUser(profile.id);

        if (followResult.success) {
          // Add to pending tracking in background
          chrome.runtime.sendMessage({
            type: "ST_ADD_PENDING",
            userId: profile.id,
            username: profile.username,
            fullName: profile.fullName,
            dmTemplate: settings.dmTemplate,
          });

          SwipeUI.showStatus(
            `Following @${profile.username} — will DM when they follow back`,
            "info",
            5000,
          );
        } else {
          SwipeUI.showStatus("Failed to follow — try again later", "error");
        }
      }
    } catch (err) {
      console.error("[ShotTaker] Swipe right error:", err);
      SwipeUI.showStatus("Error — try again later", "error");
    }
  }

  function onSwipeLeft(profile) {
    console.log(`[ShotTaker] Passed on @${profile.username}`);
    seenProfiles.add(profile.id);
    saveSeenProfiles();
  }

  // ── Profile loading helpers ──

  function filterAndDedupe(profiles) {
    const unseen = profiles.filter((p) => {
      if (seenProfiles.has(p.id)) return false;
      if (p.isPrivate) return false;
      if (p.id === currentUserId) return false;
      return true;
    });

    const uniqueMap = new Map();
    for (const p of unseen) {
      if (!uniqueMap.has(p.id)) uniqueMap.set(p.id, p);
    }
    return [...uniqueMap.values()];
  }

  async function enrichProfiles(profiles, limit = 20) {
    const enriched = [];
    for (const p of profiles.slice(0, limit)) {
      try {
        const full = await InstagramAPI.getProfileInfo(p.username);
        if (full) {
          try {
            full.recentPosts = await InstagramAPI.getUserPosts(full.id, 6);
          } catch (e) {
            full.recentPosts = [];
          }
          enriched.push(full);
        } else {
          enriched.push(p);
        }
      } catch (e) {
        enriched.push(p);
      }
    }
    return enriched;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Waterfall profile loading ──

  async function loadProfiles() {
    if (isLoading) return;
    isLoading = true;

    if (!currentUserId) {
      SwipeUI.showStatus("Could not detect your account", "error");
      isLoading = false;
      return;
    }

    try {
      // Tier 1: Your followers (warmest leads)
      SwipeUI.showStatus("Loading your followers...", "info");
      try {
        const followers = await InstagramAPI.getAllFollowers(
          currentUserId,
          200,
        );
        console.log(`[ShotTaker] Tier 1: ${followers.length} followers`);

        const tier1 = filterAndDedupe(followers);
        if (tier1.length > 0) {
          const enriched = await enrichProfiles(tier1);
          SwipeUI.setProfiles(enriched);
          SwipeUI.showStatus(`${enriched.length} followers loaded`, "success");
        }
      } catch (e) {
        console.warn("[ShotTaker] Tier 1 (followers) failed:", e);
      }

      // Tier 2: Friends of friends
      SwipeUI.showStatus("Loading friends of friends...", "info");
      try {
        const following = await InstagramAPI.getAllFollowing(
          currentUserId,
          500,
        );
        const sampled = shuffle(following).slice(0, 10);
        const fofProfiles = [];

        for (const f of sampled) {
          try {
            const result = await InstagramAPI.getFollowers(f.id, 25);
            fofProfiles.push(...result.users);
          } catch (e) {
            // Skip this person's followers on error
          }
        }

        console.log(
          `[ShotTaker] Tier 2: ${fofProfiles.length} friends-of-friends`,
        );

        const tier2 = filterAndDedupe(fofProfiles);
        if (tier2.length > 0) {
          const enriched = await enrichProfiles(tier2);
          SwipeUI.addProfiles(enriched);
          SwipeUI.showStatus(
            `+${enriched.length} friends-of-friends loaded`,
            "success",
          );
        }
      } catch (e) {
        console.warn("[ShotTaker] Tier 2 (FoF) failed:", e);
      }

      // Tier 3: Suggested users
      if (settings.sources.suggested) {
        try {
          const suggested = await InstagramAPI.getSuggestedUsers();
          console.log(`[ShotTaker] Tier 3: ${suggested.length} suggested`);

          const tier3 = filterAndDedupe(suggested);
          if (tier3.length > 0) {
            const enriched = await enrichProfiles(tier3);
            SwipeUI.addProfiles(enriched);
          }
        } catch (e) {
          console.warn("[ShotTaker] Tier 3 (suggested) failed:", e);
        }
      }
    } catch (err) {
      console.error("[ShotTaker] Profile loading error:", err);
      SwipeUI.showStatus("Error loading profiles", "error");
    }

    isLoading = false;
  }

  // ── Initialize ──
  async function init() {
    // Wait for IG to fully load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get current user ID from cookie
    currentUserId = document.cookie.match(/ds_user_id=(\d+)/)?.[1];
    if (!currentUserId) {
      console.warn("[ShotTaker] Could not find ds_user_id — not logged in?");
    }

    await loadState();

    if (!settings.enabled) return;

    // Create UI
    SwipeUI.create(onSwipeRight, onSwipeLeft);
    SwipeUI.createToggleButton();

    // Load initial profiles
    await loadProfiles();

    console.log("[ShotTaker] Initialized and ready 🎯");
  }

  // Only run on Instagram
  if (window.location.hostname.includes("instagram.com")) {
    init();
  }
})();
