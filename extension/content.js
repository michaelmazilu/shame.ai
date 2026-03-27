// ShotTaker - Content script injected into Instagram
// Injects the fetch interceptor, adds the ShotTaker button, and manages the swipe UI

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────
  let profileDeck = [];
  let currentIndex = 0;
  let panelOpen = false;
  let loggedInUserId = null;
  let isLoading = false;
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  // ── Inject the fetch interceptor into the page's main world ────────────
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("interceptor.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // ── Inject the API helper into the page context ────────────────────────
  const apiScript = document.createElement("script");
  apiScript.src = chrome.runtime.getURL("instagram-api.js");
  apiScript.onload = () => apiScript.remove();
  (document.head || document.documentElement).appendChild(apiScript);

  // ── Helpers ────────────────────────────────────────────────────────────
  const IG_APP_ID = "936619743392459";

  function getHeaders() {
    const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
    return {
      "x-ig-app-id": IG_APP_ID,
      "x-requested-with": "XMLHttpRequest",
      "x-csrftoken": csrfToken,
    };
  }

  async function apiGet(url) {
    const res = await fetch(url, {
      headers: getHeaders(),
      credentials: "include",
    });
    return res.json();
  }

  async function apiPost(url, body = {}) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...getHeaders(),
        "content-type": "application/x-www-form-urlencoded",
      },
      credentials: "include",
      body: new URLSearchParams(body),
    });
    return res.json();
  }

  // ── Fetch profile deck ─────────────────────────────────────────────────
  async function loadProfiles() {
    if (isLoading) return;
    isLoading = true;
    updateCardUI();

    try {
      // Get logged-in user's ID from the ds_user_id cookie (always present when logged in)
      if (!loggedInUserId) {
        const dsUserId = document.cookie.match(/ds_user_id=(\d+)/)?.[1];
        if (dsUserId) {
          loggedInUserId = dsUserId;
        } else {
          // Fallback: try the API
          try {
            const meData = await apiGet(
              "https://www.instagram.com/api/v1/accounts/current_user/web_info/",
            );
            loggedInUserId = meData?.data?.user?.id;
          } catch (e) {
            console.error("[ShotTaker] Could not get logged-in user ID");
          }
        }
      }

      // Get swipe history to filter out already-swiped profiles
      const history = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_SWIPE_HISTORY" }, (res) => {
          resolve(res || { liked: [], passed: [] });
        });
      });
      const seenIds = new Set([...history.liked, ...history.passed]);

      // Pull from the logged-in user's following list (paginated)
      let users = [];
      let maxId = null;

      if (loggedInUserId) {
        // Fetch up to 2 pages (100 users) to build the deck
        for (let page = 0; page < 2; page++) {
          const params = new URLSearchParams({
            count: "50",
            search_surface: "follow_list_page",
          });
          if (maxId) params.set("max_id", maxId);

          const followingData = await apiGet(
            `https://www.instagram.com/api/v1/friendships/${loggedInUserId}/following/?${params}`,
          );
          const pageUsers = followingData.users || [];
          users.push(...pageUsers);

          if (!followingData.next_max_id) break;
          maxId = followingData.next_max_id;

          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Filter out already-swiped and private accounts
      const newUsers = users.filter(
        (u) => !seenIds.has(String(u.pk || u.id)) && !u.is_private,
      );

      // Enrich each user with full profile data
      for (const user of newUsers.slice(0, 20)) {
        try {
          const profileData = await apiGet(
            `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(user.username)}`,
          );
          const full = profileData?.data?.user;
          if (full) {
            profileDeck.push({
              id: String(full.id || user.pk || user.id),
              username: full.username || user.username,
              fullName: full.full_name || user.full_name || "",
              bio: full.biography || "",
              profilePic:
                full.profile_pic_url_hd ||
                full.profile_pic_url ||
                user.profile_pic_url ||
                "",
              followerCount: full.edge_followed_by?.count || 0,
              followingCount: full.edge_follow?.count || 0,
              postCount: full.edge_owner_to_timeline_media?.count || 0,
              recentPosts: [], // web_profile_info returns empty edges; posts fetched separately if needed
              isVerified: full.is_verified || false,
              mutualCount: full.edge_mutual_followed_by?.count || 0,
              isBusinessAccount: full.is_business_account || false,
              externalUrl: full.external_url || "",
            });
          }
        } catch (e) {
          // skip profiles that fail to load
        }

        // Small delay between profile fetches to avoid rate limiting
        await new Promise((r) => setTimeout(r, 800));
      }
    } catch (err) {
      console.error("[ShotTaker] Error loading profiles:", err);
    }

    isLoading = false;
    updateCardUI();
  }

  // ── Swipe actions ──────────────────────────────────────────────────────
  async function swipeRight() {
    const profile = profileDeck[currentIndex];
    if (!profile) return;

    // Animate
    const card = document.querySelector(".st-card");
    if (card) {
      card.classList.add("st-swipe-right");
      await new Promise((r) => setTimeout(r, 300));
    }

    // Save to history
    chrome.runtime.sendMessage({
      type: "SAVE_SWIPE",
      direction: "right",
      userId: profile.id,
    });

    // Show DM composer
    showDMComposer(profile);
  }

  function swipeLeft() {
    const profile = profileDeck[currentIndex];
    if (!profile) return;

    const card = document.querySelector(".st-card");
    if (card) {
      card.classList.add("st-swipe-left");
    }

    chrome.runtime.sendMessage({
      type: "SAVE_SWIPE",
      direction: "left",
      userId: profile.id,
    });

    setTimeout(() => {
      currentIndex++;
      if (currentIndex >= profileDeck.length - 3) {
        loadProfiles();
      }
      updateCardUI();
    }, 300);
  }

  // ── DM Composer ────────────────────────────────────────────────────────
  function showDMComposer(profile) {
    const existing = document.querySelector(".st-dm-composer");
    if (existing) existing.remove();

    const composer = document.createElement("div");
    composer.className = "st-dm-composer";
    composer.innerHTML = `
      <div class="st-dm-header">
        <img src="${profile.profilePic}" class="st-dm-avatar" />
        <div>
          <div class="st-dm-name">${profile.fullName || profile.username}</div>
          <div class="st-dm-username">@${profile.username}</div>
        </div>
      </div>
      <textarea class="st-dm-input" placeholder="Shoot your shot..." rows="3"></textarea>
      <div class="st-dm-actions">
        <button class="st-btn st-btn-skip">Skip DM</button>
        <button class="st-btn st-btn-send">Send Message</button>
      </div>
    `;

    const panel = document.querySelector(".st-panel");
    const cardArea = panel?.querySelector(".st-card-area");
    if (cardArea) {
      cardArea.style.display = "none";
    }
    panel?.querySelector(".st-panel-body")?.appendChild(composer);

    composer
      .querySelector(".st-btn-send")
      .addEventListener("click", async () => {
        const text = composer.querySelector(".st-dm-input").value.trim();
        if (!text) return;

        const btn = composer.querySelector(".st-btn-send");
        btn.textContent = "Sending...";
        btn.disabled = true;

        try {
          await apiPost(
            "https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/",
            {
              recipient_users: JSON.stringify([profile.id]),
              action: "send_item",
              text: text,
            },
          );
          btn.textContent = "Sent!";
          setTimeout(() => advanceAfterDM(composer, cardArea), 800);
        } catch (e) {
          btn.textContent = "Failed - Retry";
          btn.disabled = false;
        }
      });

    composer.querySelector(".st-btn-skip").addEventListener("click", () => {
      advanceAfterDM(composer, cardArea);
    });
  }

  function advanceAfterDM(composer, cardArea) {
    composer.remove();
    if (cardArea) cardArea.style.display = "";
    currentIndex++;
    if (currentIndex >= profileDeck.length - 3) {
      loadProfiles();
    }
    updateCardUI();
  }

  // ── Card UI rendering ─────────────────────────────────────────────────
  function updateCardUI() {
    const cardArea = document.querySelector(".st-card-area");
    if (!cardArea) return;

    const profile = profileDeck[currentIndex];

    if (isLoading && !profile) {
      cardArea.innerHTML = `
        <div class="st-loading">
          <div class="st-spinner"></div>
          <p>Finding people nearby...</p>
        </div>
      `;
      return;
    }

    if (!profile) {
      cardArea.innerHTML = `
        <div class="st-empty">
          <p>No more profiles to show</p>
          <button class="st-btn st-btn-send" id="st-reload">Load More</button>
        </div>
      `;
      cardArea.querySelector("#st-reload")?.addEventListener("click", () => {
        profileDeck = [];
        currentIndex = 0;
        loadProfiles();
      });
      return;
    }

    cardArea.innerHTML = `
      <div class="st-card">
        <div class="st-card-image" style="background-image: url('${profile.profilePic}')">
          <div class="st-card-gradient"></div>
          <div class="st-card-badge st-badge-like">LIKE</div>
          <div class="st-card-badge st-badge-pass">PASS</div>
          ${profile.isVerified ? '<div class="st-verified">&#10003;</div>' : ""}
          <div class="st-card-info">
            <h3>${profile.fullName || profile.username}</h3>
            <p class="st-card-username">@${profile.username}</p>
            <p class="st-card-bio">${profile.bio || ""}</p>
          </div>
        </div>
        <div class="st-card-stats">
          <div class="st-stat"><strong>${formatCount(profile.postCount)}</strong><span>posts</span></div>
          <div class="st-stat"><strong>${formatCount(profile.followerCount)}</strong><span>followers</span></div>
          <div class="st-stat"><strong>${formatCount(profile.followingCount)}</strong><span>following</span></div>
        </div>
        ${profile.mutualCount > 0 ? `<div class="st-mutual">${profile.mutualCount} mutual friend${profile.mutualCount !== 1 ? "s" : ""}</div>` : ""}
        ${profile.externalUrl ? `<div class="st-external-link"><a href="${profile.externalUrl}" target="_blank">${profile.externalUrl.replace(/^https?:\/\//, "").slice(0, 40)}</a></div>` : ""}
        <div class="st-card-actions">
          <button class="st-action-btn st-pass" id="st-pass-btn">&#10005;</button>
          <button class="st-action-btn st-open" id="st-open-btn">&#8599;</button>
          <button class="st-action-btn st-like" id="st-like-btn">&#9829;</button>
        </div>
      </div>
    `;

    // Swipe button handlers
    cardArea
      .querySelector("#st-pass-btn")
      ?.addEventListener("click", swipeLeft);
    cardArea
      .querySelector("#st-like-btn")
      ?.addEventListener("click", swipeRight);
    cardArea.querySelector("#st-open-btn")?.addEventListener("click", () => {
      window.open(`https://www.instagram.com/${profile.username}/`, "_blank");
    });

    // Touch / mouse drag for swiping
    const card = cardArea.querySelector(".st-card");
    if (card) {
      card.addEventListener("mousedown", onDragStart);
      card.addEventListener("touchstart", onDragStart, { passive: true });
    }
  }

  // ── Drag / swipe gesture ──────────────────────────────────────────────
  function onDragStart(e) {
    isDragging = true;
    startX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    currentX = 0;

    const card = e.currentTarget;
    const onMove = (ev) => {
      if (!isDragging) return;
      const x = ev.type === "touchmove" ? ev.touches[0].clientX : ev.clientX;
      currentX = x - startX;
      card.style.transform = `translateX(${currentX}px) rotate(${currentX * 0.05}deg)`;

      const likeBadge = card.querySelector(".st-badge-like");
      const passBadge = card.querySelector(".st-badge-pass");
      if (likeBadge) likeBadge.style.opacity = Math.max(0, currentX / 100);
      if (passBadge) passBadge.style.opacity = Math.max(0, -currentX / 100);
    };

    const onEnd = () => {
      isDragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);

      if (currentX > 100) {
        swipeRight();
      } else if (currentX < -100) {
        swipeLeft();
      } else {
        card.style.transform = "";
        const likeBadge = card.querySelector(".st-badge-like");
        const passBadge = card.querySelector(".st-badge-pass");
        if (likeBadge) likeBadge.style.opacity = 0;
        if (passBadge) passBadge.style.opacity = 0;
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
  }

  function formatCount(num) {
    if (!num) return "0";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return String(num);
  }

  // ── Build the ShotTaker panel ──────────────────────────────────────────
  function createPanel() {
    const panel = document.createElement("div");
    panel.className = "st-panel";
    panel.innerHTML = `
      <div class="st-panel-header">
        <div class="st-panel-title">
          <span class="st-fire">&#128293;</span> ShotTaker
        </div>
        <button class="st-close-btn" id="st-close">&times;</button>
      </div>
      <div class="st-panel-body">
        <div class="st-card-area"></div>
      </div>
    `;

    document.body.appendChild(panel);

    panel.querySelector("#st-close").addEventListener("click", togglePanel);

    return panel;
  }

  // ── Toggle panel open/close ────────────────────────────────────────────
  function togglePanel() {
    panelOpen = !panelOpen;
    let panel = document.querySelector(".st-panel");

    if (panelOpen) {
      if (!panel) panel = createPanel();
      panel.classList.add("st-panel-open");
      if (profileDeck.length === 0) loadProfiles();
    } else if (panel) {
      panel.classList.remove("st-panel-open");
    }
  }

  // ── Inject the ShotTaker button into Instagram's nav ───────────────────
  function injectButton() {
    if (document.querySelector("#st-nav-btn")) return;

    // Instagram's nav bar contains SVG icon buttons -- find the nav element
    const nav = document.querySelector('nav, [role="navigation"]');
    if (!nav) return;

    // Look for the button/link container area in the nav
    // IG uses a span or div wrapping each nav icon
    const navLinks = nav.querySelectorAll('a[href], div[role="button"]');
    if (navLinks.length === 0) return;

    // Find the last nav item to insert next to it
    const lastNavItem = navLinks[navLinks.length - 1];
    const parentContainer = lastNavItem.parentElement;

    const btnWrapper = document.createElement("div");
    btnWrapper.id = "st-nav-btn";
    btnWrapper.className = "st-nav-btn-wrapper";
    btnWrapper.title = "ShotTaker";
    btnWrapper.innerHTML = `
      <div class="st-nav-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </div>
    `;

    btnWrapper.addEventListener("click", togglePanel);

    // Insert as sibling of the last nav item's parent
    if (parentContainer && parentContainer.parentElement) {
      parentContainer.parentElement.appendChild(btnWrapper);
    } else {
      nav.appendChild(btnWrapper);
    }
  }

  // ── Initialization ─────────────────────────────────────────────────────
  function init() {
    // Try to inject button immediately, then keep retrying as IG loads dynamically
    injectButton();

    const observer = new MutationObserver(() => {
      if (!document.querySelector("#st-nav-btn")) {
        injectButton();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Listen for intercepted data from the page context
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      if (event.data?.type === "ST_PROFILE_DATA") {
        // Can use intercepted data to supplement the deck
      }
    });
  }

  // Wait for the page to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
