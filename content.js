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

  // ── Load persisted state ──
  async function loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["st_settings", "st_seen", "st_dms_hour", "st_dms_reset"],
        (data) => {
          if (data.st_settings) settings = { ...settings, ...data.st_settings };
          if (data.st_seen) seenProfiles = new Set(data.st_seen);

          // Reset hourly DM counter if hour has passed
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

    // Capture GraphQL tokens (fb_dtsg, lsd) from interceptor
    if (event.data?.type === "ST_TOKENS") {
      InstagramAPI.setGraphQLTokens(event.data.payload);
      return;
    }

    if (event.data?.type !== "ST_DATA") return;

    const { subtype, payload } = event.data;
    console.log(`[ShotTaker] Intercepted: ${subtype}`);

    // We can use passively intercepted data to enrich profiles
    // but primarily we fetch profiles actively below
  });

  // ── Listen for settings updates from popup ──
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
        queueSize: 0, // Updated by SwipeUI
      });
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

    // Send DM
    SwipeUI.showStatus("Sending your shot...", "info");

    try {
      const result = await InstagramAPI.sendDMGraphQL(
        profile.id,
        settings.dmTemplate,
      );

      if (result.success) {
        incrementDMCounter();
        SwipeUI.showStatus(`Shot sent to @${profile.username}! 💘`, "success");

        // Notify background for history
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
    } catch (err) {
      console.error("[ShotTaker] DM error:", err);
      SwipeUI.showStatus("Error sending DM", "error");
    }
  }

  function onSwipeLeft(profile) {
    console.log(`[ShotTaker] Passed on @${profile.username}`);
    seenProfiles.add(profile.id);
    saveSeenProfiles();
  }

  // ── Fetch profiles from all sources ──
  async function loadProfiles() {
    if (isLoading) return;
    isLoading = true;

    const allProfiles = [];

    try {
      // Source 1: Suggested users
      if (settings.sources.suggested) {
        try {
          const suggested = await InstagramAPI.getSuggestedUsers();
          allProfiles.push(...suggested);
          console.log(`[ShotTaker] Got ${suggested.length} suggested profiles`);
        } catch (e) {
          console.warn("[ShotTaker] Failed to fetch suggested:", e);
        }
      }

      // Source 2: Explore page
      if (settings.sources.explore) {
        try {
          const explore = await InstagramAPI.getExploreProfiles();
          allProfiles.push(...explore);
          console.log(`[ShotTaker] Got ${explore.length} explore profiles`);
        } catch (e) {
          console.warn("[ShotTaker] Failed to fetch explore:", e);
        }
      }

      // Filter out seen profiles and deduplicate
      const unseenProfiles = allProfiles.filter((p) => {
        if (seenProfiles.has(p.id)) return false;
        if (p.isPrivate) return false; // Skip private accounts
        return true;
      });

      // Deduplicate by ID
      const uniqueMap = new Map();
      for (const p of unseenProfiles) {
        if (!uniqueMap.has(p.id)) uniqueMap.set(p.id, p);
      }
      const unique = [...uniqueMap.values()];

      console.log(
        `[ShotTaker] ${unique.length} unique unseen profiles ready to swipe`,
      );

      // Enrich top profiles with full info (profile pic HD, bio, followers)
      const enriched = [];
      for (const p of unique.slice(0, 20)) {
        try {
          const full = await InstagramAPI.getProfileInfo(p.username);
          if (full) {
            enriched.push(full);
          } else {
            enriched.push(p);
          }
        } catch (e) {
          enriched.push(p); // Use basic info if enrichment fails
        }
      }

      if (enriched.length > 0) {
        SwipeUI.setProfiles(enriched);
        SwipeUI.showStatus(`${enriched.length} profiles loaded`, "success");
      } else {
        SwipeUI.showStatus("No new profiles found — try again later", "info");
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
