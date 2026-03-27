// Instagram API helpers -- uses the logged-in user's session cookies automatically

const IG_APP_ID = "936619743392459";

function getHeaders() {
  const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
  return {
    "x-ig-app-id": IG_APP_ID,
    "x-requested-with": "XMLHttpRequest",
    "x-csrftoken": csrfToken,
    "content-type": "application/x-www-form-urlencoded",
  };
}

// Get the logged-in user's own info
async function getLoggedInUser() {
  const res = await fetch(
    "https://www.instagram.com/api/v1/accounts/current_user/web_info/",
    {
      headers: getHeaders(),
      credentials: "include",
    },
  );
  const data = await res.json();
  return data.data?.user || null;
}

// Resolve a username to full profile data
async function getProfileByUsername(username) {
  const res = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    { headers: getHeaders(), credentials: "include" },
  );
  const data = await res.json();
  return data.data?.user || null;
}

// Get the following list for a user ID (paginated)
async function getFollowing(userId, maxId = null) {
  const params = new URLSearchParams({
    count: "50",
    search_surface: "follow_list_page",
  });
  if (maxId) params.set("max_id", maxId);

  const res = await fetch(
    `https://www.instagram.com/api/v1/friendships/${userId}/following/?${params}`,
    { headers: getHeaders(), credentials: "include" },
  );
  return res.json();
}

// Get suggested users (Instagram's "people you may know")
async function getSuggestedUsers() {
  const res = await fetch("https://www.instagram.com/api/v1/discover/ayml/", {
    method: "POST",
    headers: getHeaders(),
    credentials: "include",
    body: new URLSearchParams({
      phone_id: crypto.randomUUID(),
      module: "discover_people",
    }),
  });
  const data = await res.json();
  const groups = data.groups || [];
  const users = [];
  for (const group of groups) {
    for (const item of group.items || []) {
      if (item.user) users.push(item.user);
    }
  }
  return users;
}

// Get a user's recent posts (for the swipe card preview)
async function getUserPosts(userId) {
  const res = await fetch(
    `https://www.instagram.com/api/v1/feed/user/${userId}/?count=6`,
    { headers: getHeaders(), credentials: "include" },
  );
  const data = await res.json();
  return (data.items || []).map((item) => ({
    id: item.id,
    imageUrl: item.image_versions2?.candidates?.[0]?.url || "",
    caption: item.caption?.text || "",
    likeCount: item.like_count || 0,
  }));
}

// Send a DM to a user
async function sendDM(userId, message) {
  const res = await fetch(
    "https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/",
    {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      body: new URLSearchParams({
        recipient_users: JSON.stringify([userId]),
        action: "send_item",
        text: message,
      }),
    },
  );
  return res.json();
}

// Follow a user
async function followUser(userId) {
  const res = await fetch(
    `https://www.instagram.com/api/v1/friendships/create/${userId}/`,
    {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
    },
  );
  return res.json();
}
