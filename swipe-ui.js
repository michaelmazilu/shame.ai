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
        <span id="st-logo">🎯 ShotTaker</span>
        <button id="st-minimize">−</button>
      </div>
      <div id="st-card-area">
        <div id="st-empty-state">
          <p>Loading profiles...</p>
          <div id="st-spinner"></div>
        </div>
      </div>
      <div id="st-actions">
        <button id="st-pass" title="Pass">✕</button>
        <button id="st-shoot" title="Shoot Your Shot">💘</button>
      </div>
      <div id="st-status"></div>
    `;

    document.body.appendChild(container);

    // Minimize toggle
    const minimizeBtn = container.querySelector("#st-minimize");
    const cardArea = container.querySelector("#st-card-area");
    const actions = container.querySelector("#st-actions");
    let minimized = false;

    minimizeBtn.addEventListener("click", () => {
      minimized = !minimized;
      cardArea.style.display = minimized ? "none" : "block";
      actions.style.display = minimized ? "none" : "flex";
      minimizeBtn.textContent = minimized ? "+" : "−";
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

    const recentPostHtml =
      profile.recentPosts && profile.recentPosts.length > 0
        ? `<div class="st-recent-posts">
            ${profile.recentPosts
              .map(
                (p) =>
                  `<img src="${p.thumbnail || p.url}" class="st-post-thumb" alt="post" />`,
              )
              .join("")}
           </div>`
        : "";

    card.innerHTML = `
      <div class="st-card-image" style="background-image: url('${profile.profilePic}')">
        <div class="st-swipe-label st-label-like">SHOOT 💘</div>
        <div class="st-swipe-label st-label-pass">PASS ✕</div>
      </div>
      <div class="st-card-info">
        <h3 class="st-card-name">${profile.fullName || profile.username}</h3>
        <p class="st-card-username">@${profile.username}</p>
        ${profile.bio ? `<p class="st-card-bio">${truncate(profile.bio, 120)}</p>` : ""}
        <div class="st-card-stats">
          ${profile.followers != null ? `<span>${formatCount(profile.followers)} followers</span>` : ""}
          ${profile.mutualFollowers ? `<span class="st-mutual">${profile.mutualFollowers}</span>` : ""}
        </div>
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
      if (direction === "right" && onSwipeRight) {
        onSwipeRight(profile);
      } else if (direction === "left" && onSwipeLeft) {
        onSwipeLeft(profile);
      }
      showNextCard();
    }, 400);
  }

  function showStatus(message, type = "info") {
    const status = container.querySelector("#st-status");
    status.textContent = message;
    status.className = `st-status-${type}`;
    status.style.opacity = 1;
    setTimeout(() => {
      status.style.opacity = 0;
    }, 3000);
  }

  function updateCounter() {
    const header = container.querySelector("#st-logo");
    header.textContent = `🎯 ShotTaker (${cardStack.length + (currentCard ? 1 : 0)})`;
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
    btn.innerHTML = "🎯";
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
  };
})();
