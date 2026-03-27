// instagram-api.js — Direct API calls to Instagram's internal endpoints
// Uses the browser's existing session cookies for authentication

const InstagramAPI = (() => {
  const APP_ID = "936619743392459";

  function getHeaders() {
    const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || "";
    return {
      "x-ig-app-id": APP_ID,
      "x-requested-with": "XMLHttpRequest",
      "x-csrftoken": csrfToken,
    };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Rate-limit wrapper — minimum 2.5s between calls
  let lastCallTime = 0;
  async function rateLimitedFetch(url, options = {}) {
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < 2500) {
      await delay(2500 - elapsed);
    }
    lastCallTime = Date.now();

    const response = await fetch(url, {
      ...options,
      headers: { ...getHeaders(), ...(options.headers || {}) },
      credentials: "include",
    });

    if (response.status === 429) {
      console.warn("[ShotTaker] Rate limited — backing off 30s");
      await delay(30000);
      return rateLimitedFetch(url, options);
    }

    return response;
  }

  // Resolve username → full profile data
  async function getProfileInfo(username) {
    const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const resp = await rateLimitedFetch(url);
    const data = await resp.json();
    const user = data?.data?.user;
    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      bio: user.biography,
      profilePic: user.profile_pic_url_hd || user.profile_pic_url,
      followers: user.edge_followed_by?.count || 0,
      following: user.edge_follow?.count || 0,
      postCount: user.edge_owner_to_timeline_media?.count || 0,
      isPrivate: user.is_private,
      isVerified: user.is_verified || false,
      isBusiness: user.is_business_account || false,
      isProfessional: user.is_professional_account || false,
      categoryName: user.category_name || user.business_category_name || null,
      pronouns: user.pronouns || [],
      externalUrl: user.external_url || null,
      mutualFollowers: user.edge_mutual_followed_by?.count || 0,
      mutualFollowerNames: (user.edge_mutual_followed_by?.edges || []).map(
        (e) => e.node?.username,
      ),
      followedByViewer: user.followed_by_viewer || false,
      followsViewer: user.follows_viewer || false,
      highlightReelCount: user.highlight_reel_count || 0,
      isJoinedRecently: user.is_joined_recently || false,
    };
  }

  // Fetch followers list (paginated)
  async function getFollowers(userId, count = 200, maxId = null) {
    let url = `https://www.instagram.com/api/v1/friendships/${userId}/followers/?count=${count}&search_surface=follow_list_page`;
    if (maxId) url += `&max_id=${maxId}`;

    const resp = await rateLimitedFetch(url);
    const data = await resp.json();

    const users = (data.users || []).map((u) => ({
      id: u.pk || u.pk_id,
      username: u.username,
      fullName: u.full_name,
      profilePic: u.profile_pic_url,
      isPrivate: u.is_private,
    }));

    return {
      users,
      nextMaxId: data.next_max_id || null,
      hasMore: !!data.next_max_id,
    };
  }

  // Fetch ALL followers (auto-paginate)
  async function getAllFollowers(userId, limit = 500) {
    const allUsers = [];
    let maxId = null;

    do {
      const result = await getFollowers(userId, 200, maxId);
      allUsers.push(...result.users);
      maxId = result.nextMaxId;

      if (allUsers.length >= limit) break;
    } while (maxId);

    return allUsers.slice(0, limit);
  }

  // Fetch following list (paginated)
  async function getFollowing(userId, maxId = null) {
    let url = `https://www.instagram.com/api/v1/friendships/${userId}/following/?count=200&search_surface=follow_list_page`;
    if (maxId) url += `&max_id=${maxId}`;

    const resp = await rateLimitedFetch(url);
    const data = await resp.json();

    const users = (data.users || []).map((u) => ({
      id: u.pk || u.pk_id,
      username: u.username,
      fullName: u.full_name,
      profilePic: u.profile_pic_url,
      isPrivate: u.is_private,
    }));

    return {
      users,
      nextMaxId: data.next_max_id || null,
      hasMore: !!data.next_max_id,
    };
  }

  // Fetch ALL following (auto-paginate)
  async function getAllFollowing(userId, limit = 500) {
    const allUsers = [];
    let maxId = null;

    do {
      const result = await getFollowing(userId, maxId);
      allUsers.push(...result.users);
      maxId = result.nextMaxId;

      if (allUsers.length >= limit) break;
    } while (maxId);

    return allUsers.slice(0, limit);
  }

  // Fetch suggested users
  async function getSuggestedUsers() {
    const url = "https://www.instagram.com/api/v1/discover/ayml/";
    const resp = await rateLimitedFetch(url);
    const data = await resp.json();

    const groups = data?.groups || [];
    const users = [];

    for (const group of groups) {
      for (const item of group.items || []) {
        const u = item.user;
        if (u) {
          users.push({
            id: u.pk || u.pk_id,
            username: u.username,
            fullName: u.full_name,
            profilePic: u.profile_pic_url,
            isPrivate: u.is_private,
            mutualFollowers: item.social_context || "",
          });
        }
      }
    }

    return users;
  }

  // Fetch explore page profiles
  async function getExploreProfiles() {
    const url = "https://www.instagram.com/api/v1/discover/topical_explore/";
    const resp = await rateLimitedFetch(url);
    const data = await resp.json();

    const users = [];
    const items = data?.sectional_items || data?.items || [];

    for (const section of items) {
      const mediaItems = section.layout_content?.medias || [];
      for (const media of mediaItems) {
        const u = media?.media?.user;
        if (u && !users.find((existing) => existing.id === (u.pk || u.pk_id))) {
          users.push({
            id: u.pk || u.pk_id,
            username: u.username,
            fullName: u.full_name,
            profilePic: u.profile_pic_url,
            isPrivate: u.is_private,
          });
        }
      }
    }

    return users;
  }

  // Fetch a user's recent posts via feed endpoint
  async function getUserPosts(userId, count = 6) {
    const url = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=${count}`;
    const resp = await rateLimitedFetch(url);
    const data = await resp.json();

    return (data.items || []).map((item) => {
      const candidates = item.image_versions2?.candidates || [];
      const bestImage = candidates[0]; // largest resolution

      return {
        id: item.pk,
        mediaType: item.media_type, // 1=photo, 2=video, 8=carousel
        imageUrl: bestImage?.url || null,
        imageWidth: bestImage?.width || null,
        imageHeight: bestImage?.height || null,
        caption: item.caption?.text || null,
        likeCount: item.like_count || 0,
        commentCount: item.comment_count || 0,
        playCount: item.play_count || 0,
        takenAt: item.taken_at,
        location: item.location
          ? {
              name: item.location.name,
              city: item.location.city,
              lat: item.location.lat,
              lng: item.location.lng,
            }
          : null,
        usertags: (item.usertags?.in || []).map((t) => ({
          username: t.user?.username,
          id: t.user?.pk,
        })),
        musicMetadata: item.music_metadata?.music_info?.music_asset_info
          ? {
              title: item.music_metadata.music_info.music_asset_info.title,
              artist:
                item.music_metadata.music_info.music_asset_info.display_artist,
            }
          : null,
        isPaidPartnership: item.is_paid_partnership || false,
        productType: item.product_type || null, // "clips" = reel
        coauthors: (item.coauthor_producers || []).map((c) => ({
          username: c.username,
          id: c.pk,
        })),
      };
    });
  }

  // Send a DM — shoot your shot (legacy REST endpoint)
  async function sendDM(userId, text) {
    const url =
      "https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/";

    const body = new URLSearchParams({
      recipient_users: JSON.stringify([userId]),
      action: "send_item",
      text: text,
    });

    const resp = await rateLimitedFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body,
    });

    const data = await resp.json();
    return { success: resp.ok, data };
  }

  // Follow a user
  async function followUser(userId) {
    const url = `https://www.instagram.com/api/v1/friendships/create/${userId}/`;

    const body = new URLSearchParams({
      container_module: "profile",
      user_id: userId,
    });

    const resp = await rateLimitedFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body,
    });

    const data = await resp.json();
    return { success: resp.ok, data };
  }

  // Unfollow a user
  async function unfollowUser(userId) {
    const url = `https://www.instagram.com/api/v1/friendships/destroy/${userId}/`;

    const body = new URLSearchParams({
      container_module: "profile",
      user_id: userId,
    });

    const resp = await rateLimitedFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body,
    });

    const data = await resp.json();
    return { success: resp.ok, data };
  }

  // Check relationship with a specific user (does THEY follow YOU, etc.)
  async function checkRelationship(userId) {
    const url = `https://www.instagram.com/api/v1/friendships/show/${userId}/`;
    const resp = await rateLimitedFetch(url);
    const data = await resp.json();
    return {
      followedBy: !!data.followed_by,
      following: !!data.following,
      outgoingRequest: !!data.outgoing_request,
    };
  }

  // ── GraphQL DM send (IGDirectTextSendMutation) ──

  let graphQLTokens = null;

  function setGraphQLTokens(tokens) {
    graphQLTokens = tokens;
    console.log("[ShotTaker] GraphQL tokens acquired");
  }

  function hasGraphQLTokens() {
    return graphQLTokens && graphQLTokens.fb_dtsg && graphQLTokens.lsd;
  }

  function generateOfflineThreadingId() {
    // Client-generated unique ID — random 19-digit number (matches IG's format)
    return String(Math.floor(Math.random() * 9e18) + 1e18);
  }

  async function sendDMGraphQL(recipientUserId, text) {
    if (!hasGraphQLTokens()) {
      console.warn("[ShotTaker] No GraphQL tokens — falling back to REST API");
      return sendDM(recipientUserId, text);
    }

    const variables = {
      ig_thread_igid: null,
      offline_threading_id: generateOfflineThreadingId(),
      recipient_igids: [String(recipientUserId)],
      replied_to_client_context: null,
      replied_to_item_id: null,
      reply_to_message_id: null,
      sampled: null,
      text: { sensitive_string_value: text },
      mentions: [],
      mentioned_user_ids: [],
      commands: null,
    };

    const body = new URLSearchParams({
      fb_dtsg: graphQLTokens.fb_dtsg,
      lsd: graphQLTokens.lsd,
      __a: "1",
      __user: "0",
      __comet_req: "7",
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "IGDirectTextSendMutation",
      server_timestamps: "true",
      variables: JSON.stringify(variables),
      doc_id: "25288447354146606",
    });

    const resp = await rateLimitedFetch(
      "https://www.instagram.com/api/graphql",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-fb-friendly-name": "IGDirectTextSendMutation",
        },
        body: body,
      },
    );

    const data = await resp.json();
    const success = resp.ok && !data?.errors?.length;
    return { success, data };
  }

  return {
    getProfileInfo,
    getFollowers,
    getAllFollowers,
    getFollowing,
    getAllFollowing,
    getSuggestedUsers,
    getExploreProfiles,
    sendDM,
    sendDMGraphQL,
    followUser,
    unfollowUser,
    checkRelationship,
    setGraphQLTokens,
    hasGraphQLTokens,
    getUserPosts,
    getHeaders,
  };
})();
