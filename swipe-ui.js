// swipe-ui.js — Tinder-style card stack with drag-to-swipe gestures

const SwipeUI = (() => {
  let container = null;
  let cardStack = [];
  let currentCard = null;
  let onSwipeRight = null; // callback(profile)
  let onSwipeLeft = null; // callback(profile)
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;

  const SWIPE_THRESHOLD = 100; // px to trigger a swipe action

  function create(onRight, onLeft) {
    onSwipeRight = onRight;
    onSwipeLeft = onLeft;

    // Main container
    container = document.createElement("div");
    container.id = "shottaker-container";
    container.innerHTML = `
      <div id="st-header">
        <span id="st-logo">ShotTaker</span>
        <button type="button" id="st-minimize" aria-label="Minimize panel">−</button>
      </div>
      <div id="st-card-area">
        <div id="st-empty-state">
          <p>Loading profiles...</p>
          <div id="st-spinner"></div>
        </div>
      </div>
      <div id="st-actions">
        <button type="button" id="st-pass" class="st-action-btn" title="Pass">Pass</button>
        <button type="button" id="st-shoot" class="st-action-btn st-action-primary" title="Send message">Shoot</button>
      </div>
      <div id="st-status"></div>
    `;

    document.body.appendChild(container);

    // Minimize toggle
    const minimizeBtn = container.querySelector("#st-minimize");
    const cardArea = container.querySelector("#st-card-area");
    const actions = container.querySelector("#st-actions");
    let minimized = false;

    minimizeBtn.setAttribute("aria-expanded", "true");
    minimizeBtn.addEventListener("click", () => {
      minimized = !minimized;
      cardArea.style.display = minimized ? "none" : "block";
      actions.style.display = minimized ? "none" : "flex";
      minimizeBtn.textContent = minimized ? "+" : "−";
      minimizeBtn.setAttribute("aria-expanded", minimized ? "false" : "true");
    });

    // Button actions
    container.querySelector("#st-pass").addEventListener("click", () => {
      if (currentCard) animateSwipe("left");
    });

    container.querySelector("#st-shoot").addEventListener("click", () => {
      if (currentCard) animateSwipe("right");
    });
  }

  function setProfiles(profiles) {
    cardStack = [...profiles];
    showNextCard();
  }

  function addProfiles(profiles) {
    cardStack.push(...profiles);
    if (!currentCard) showNextCard();
  }

  function showNextCard() {
    const cardArea = container.querySelector("#st-card-area");
    const emptyState = container.querySelector("#st-empty-state");

    // Remove old card
    const oldCard = cardArea.querySelector(".st-card");
    if (oldCard) oldCard.remove();

    if (cardStack.length === 0) {
      emptyState.style.display = "flex";
      emptyState.querySelector("p").textContent = "No more profiles nearby";
      emptyState.querySelector("#st-spinner").style.display = "none";
      currentCard = null;
      return;
    }

    emptyState.style.display = "none";
    const profile = cardStack.shift();

    const card = document.createElement("div");
    card.className = "st-card";
    card.dataset.userId = profile.id;
    card.dataset.username = profile.username;

    // Build recent posts grid from feed data
    const posts = profile.recentPosts || [];
    const postImages = posts.filter((p) => p.imageUrl).slice(0, 6);
    const recentPostHtml =
      postImages.length > 0
        ? `<div class="st-recent-posts">
            ${postImages
              .map(
                (p) =>
                  `<img src="${p.imageUrl}" class="st-post-thumb" alt="post" />`,
              )
              .join("")}
           </div>`
        : "";

    // Location from their posts
    const locations = posts
      .filter((p) => p.location?.name)
      .map((p) => p.location.name);
    const uniqueLocations = [...new Set(locations)].slice(0, 2);
    const locationHtml =
      uniqueLocations.length > 0
        ? `<p class="st-card-location"><span class="st-loc-label">Location</span> ${uniqueLocations.join(", ")}</p>`
        : "";

    // Engagement info
    const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
    const avgLikes =
      posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;

    // Badges line (verified, pronouns, category)
    const badges = [];
    if (profile.isVerified) badges.push("Verified");
    if (profile.pronouns?.length) badges.push(profile.pronouns.join("/"));
    if (profile.categoryName) badges.push(profile.categoryName);
    const badgeHtml =
      badges.length > 0
        ? `<p class="st-card-badges">${badges.join(" · ")}</p>`
        : "";

    // Mutual followers
    const mutualHtml =
      profile.mutualFollowers > 0
        ? `<span class="st-mutual">${profile.mutualFollowers} mutual${profile.mutualFollowerNames?.length ? " incl. " + profile.mutualFollowerNames.slice(0, 2).join(", ") : ""}</span>`
        : "";

    // Latest caption snippet
    const latestCaption = posts.find((p) => p.caption)?.caption || "";
    const captionHtml = latestCaption
      ? `<p class="st-card-caption">"${truncate(latestCaption, 100)}"</p>`
      : "";

    card.innerHTML = `
      <div class="st-card-image" style="background-image: url('${profile.profilePic}')">
        <div class="st-swipe-label st-label-like">Shoot</div>
        <div class="st-swipe-label st-label-pass">Pass</div>
      </div>
      <div class="st-card-info">
        <h3 class="st-card-name">${profile.fullName || profile.username}</h3>
        <p class="st-card-username">@${profile.username}</p>
        ${badgeHtml}
        ${profile.bio ? `<p class="st-card-bio">${truncate(profile.bio, 120)}</p>` : ""}
        ${locationHtml}
        <div class="st-card-stats">
          ${profile.followers != null ? `<span>${formatCount(profile.followers)} followers</span>` : ""}
          ${profile.postCount ? `<span>${formatCount(profile.postCount)} posts</span>` : ""}
          ${avgLikes > 0 ? `<span>~${formatCount(avgLikes)} avg likes</span>` : ""}
          ${mutualHtml}
        </div>
        ${captionHtml}
        ${recentPostHtml}
      </div>
    `;

    card._profile = profile;
    cardArea.appendChild(card);
    currentCard = card;

    // Attach drag listeners
    card.addEventListener("mousedown", onDragStart);
    card.addEventListener("touchstart", onDragStart, { passive: true });

    updateCounter();
  }

  function onDragStart(e) {
    if (!currentCard) return;
    isDragging = true;
    startX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
    currentCard.style.transition = "none";

    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onDragMove, { passive: true });
    document.addEventListener("touchend", onDragEnd);
  }

  function onDragMove(e) {
    if (!isDragging || !currentCard) return;
    const x = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    currentX = x - startX;

    const rotation = currentX * 0.1;
    const opacity = Math.min(Math.abs(currentX) / SWIPE_THRESHOLD, 1);

    currentCard.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;

    // Show swipe labels
    const likeLabel = currentCard.querySelector(".st-label-like");
    const passLabel = currentCard.querySelector(".st-label-pass");

    if (currentX > 0) {
      likeLabel.style.opacity = opacity;
      passLabel.style.opacity = 0;
    } else {
      passLabel.style.opacity = opacity;
      likeLabel.style.opacity = 0;
    }
  }

  function onDragEnd() {
    if (!isDragging || !currentCard) return;
    isDragging = false;

    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("touchend", onDragEnd);

    if (Math.abs(currentX) >= SWIPE_THRESHOLD) {
      animateSwipe(currentX > 0 ? "right" : "left");
    } else {
      // Snap back
      currentCard.style.transition = "transform 0.3s ease";
      currentCard.style.transform = "translateX(0) rotate(0)";
      currentCard.querySelector(".st-label-like").style.opacity = 0;
      currentCard.querySelector(".st-label-pass").style.opacity = 0;
    }
    currentX = 0;
  }

  function animateSwipe(direction) {
    if (!currentCard) return;
    const profile = currentCard._profile;
    const offscreen = direction === "right" ? 600 : -600;
    const rotation = direction === "right" ? 30 : -30;

    currentCard.style.transition = "transform 0.4s ease, opacity 0.4s ease";
    currentCard.style.transform = `translateX(${offscreen}px) rotate(${rotation}deg)`;
    currentCard.style.opacity = "0";

    setTimeout(() => {
      if (direction === "left" && onSwipeLeft) {
        onSwipeLeft(profile);
        showNextCard();
      } else if (direction === "right") {
        showNextCard();
        openMessageModal(profile);
      }
    }, 400);
  }

  // ── Message modal (generate → edit → send) ──

  let modalEl = null;

  function openMessageModal(profile) {
    if (modalEl) modalEl.remove();

    modalEl = document.createElement("div");
    modalEl.id = "st-msg-modal";
    modalEl.innerHTML = `
      <div class="st-modal-backdrop"></div>
      <div class="st-modal-panel">
        <div class="st-modal-header">
          <span class="st-modal-title">Message for @${profile.username}</span>
          <button type="button" class="st-modal-close" aria-label="Cancel">Cancel</button>
        </div>
        <div class="st-modal-body">
          <div class="st-modal-loading">
            <div id="st-modal-spinner"></div>
            <span>Generating message…</span>
          </div>
          <textarea class="st-modal-textarea" style="display:none" rows="3"></textarea>
          <div class="st-modal-error" style="display:none"></div>
        </div>
        <div class="st-modal-actions" style="display:none">
          <button type="button" class="st-modal-btn st-modal-reroll">Reroll</button>
          <button type="button" class="st-modal-btn st-modal-send">Send</button>
        </div>
        <div class="st-modal-fallback" style="display:none">
          <button type="button" class="st-modal-btn st-modal-retry">Retry</button>
          <button type="button" class="st-modal-btn st-modal-use-template">Use fallback template</button>
        </div>
      </div>
    `;

    container.appendChild(modalEl);

    const backdrop = modalEl.querySelector(".st-modal-backdrop");
    const closeBtn = modalEl.querySelector(".st-modal-close");
    const loadingEl = modalEl.querySelector(".st-modal-loading");
    const textareaEl = modalEl.querySelector(".st-modal-textarea");
    const errorEl = modalEl.querySelector(".st-modal-error");
    const actionsEl = modalEl.querySelector(".st-modal-actions");
    const fallbackEl = modalEl.querySelector(".st-modal-fallback");
    const rerollBtn = modalEl.querySelector(".st-modal-reroll");
    const sendBtn = modalEl.querySelector(".st-modal-send");
    const retryBtn = modalEl.querySelector(".st-modal-retry");
    const templateBtn = modalEl.querySelector(".st-modal-use-template");

    function dismiss() {
      if (modalEl) { modalEl.remove(); modalEl = null; }
    }

    function showLoading() {
      loadingEl.style.display = "flex";
      textareaEl.style.display = "none";
      errorEl.style.display = "none";
      actionsEl.style.display = "none";
      fallbackEl.style.display = "none";
    }

    function showResult(text) {
      loadingEl.style.display = "none";
      textareaEl.style.display = "block";
      textareaEl.value = text;
      actionsEl.style.display = "flex";
      errorEl.style.display = "none";
      fallbackEl.style.display = "none";
      textareaEl.focus();
    }

    function showError(msg) {
      loadingEl.style.display = "none";
      textareaEl.style.display = "none";
      errorEl.style.display = "block";
      errorEl.textContent = msg;
      actionsEl.style.display = "none";
      fallbackEl.style.display = "flex";
    }

    let generating = false;

    function requestGenerate() {
      if (generating) return;
      generating = true;
      showLoading();
      chrome.runtime.sendMessage({ type: "ST_GENERATE_MESSAGE" }, (resp) => {
        generating = false;
        if (resp?.ok) {
          showResult(resp.message);
        } else {
          showError("Could not generate message. Check your network and try again.");
        }
      });
    }

    backdrop.addEventListener("click", dismiss);
    closeBtn.addEventListener("click", dismiss);
    rerollBtn.addEventListener("click", requestGenerate);
    retryBtn.addEventListener("click", requestGenerate);

    sendBtn.addEventListener("click", () => {
      const message = textareaEl.value.trim();
      if (!message) return;
      sendBtn.disabled = true;
      sendBtn.textContent = "Sending…";
      rerollBtn.disabled = true;
      dismiss();
      onSwipeRight(profile, message);
    });

    templateBtn.addEventListener("click", () => {
      templateBtn.disabled = true;
      dismiss();
      onSwipeRight(profile, null);
    });

    requestGenerate();
  }

  function showStatus(message, type = "info", duration = 3000) {
    const status = container.querySelector("#st-status");
    status.textContent = message;
    status.className = `st-status-${type}`;
    status.style.opacity = 1;
    setTimeout(() => {
      status.style.opacity = 0;
    }, duration);
  }

  function updateCounter() {
    const header = container.querySelector("#st-logo");
    header.textContent = `ShotTaker · ${cardStack.length + (currentCard ? 1 : 0)}`;
  }

  function truncate(str, max) {
    return str.length > max ? str.slice(0, max) + "…" : str;
  }

  function formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toString();
  }

  // Toggle button to inject into IG nav
  function createToggleButton() {
    const btn = document.createElement("div");
    btn.id = "st-toggle-btn";
    btn.innerHTML = '<span class="st-toggle-monogram">ST</span>';
    btn.title = "Toggle ShotTaker";
    btn.addEventListener("click", () => {
      if (!container) return;
      const isVisible = container.style.display !== "none";
      container.style.display = isVisible ? "none" : "flex";
    });
    document.body.appendChild(btn);
  }

  return {
    create,
    setProfiles,
    addProfiles,
    showStatus,
    createToggleButton,
    updateCounter,
    openMessageModal,
  };
})();
