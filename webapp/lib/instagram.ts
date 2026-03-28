import type { IGProfile, IGPost, IGSession } from "./types";
import { rateLimit, backoff429 } from "./rate-limiter";

const APP_ID = "936619743392459";
const BASE = "https://www.instagram.com";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function buildHeaders(session: IGSession): Record<string, string> {
  return {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "sec-ch-prefers-color-scheme": "dark",
    "sec-ch-ua":
      '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
    "sec-ch-ua-full-version-list":
      '"Chromium";v="146.0.7680.155", "Not-A.Brand";v="24.0.0.0", "Google Chrome";v="146.0.7680.155"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": '""',
    "sec-ch-ua-platform": '"macOS"',
    "sec-ch-ua-platform-version": '"15.7.3"',
    "user-agent": USER_AGENT,
    "x-asbd-id": "359341",
    "x-ig-app-id": APP_ID,
    "x-ig-www-claim": "",
    "x-instagram-ajax": "1036193752",
    "x-requested-with": "XMLHttpRequest",
    "x-csrftoken": session.csrfToken,
    cookie: session.cookies,
    referer: "https://www.instagram.com/",
    origin: "https://www.instagram.com",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  };
}

async function igFetch(
  url: string,
  session: IGSession,
  options: RequestInit = {},
): Promise<Response> {
  const isWrite = options.method === "POST";
  await rateLimit(session.userId, isWrite);

  const resp = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(session),
      ...((options.headers as Record<string, string>) || {}),
    },
  });

  if (resp.status === 429) {
    console.warn("[IG] Rate limited — backing off 30s");
    await backoff429();
    return igFetch(url, session, options);
  }

  return resp;
}

// ── Profile ──

export async function getProfileInfo(
  session: IGSession,
  username: string,
): Promise<IGProfile | null> {
  const url = `${BASE}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const resp = await igFetch(url, session);
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
      (e: { node?: { username: string } }) => e.node?.username,
    ),
    followedByViewer: user.followed_by_viewer || false,
    followsViewer: user.follows_viewer || false,
    highlightReelCount: user.highlight_reel_count || 0,
    isJoinedRecently: user.is_joined_recently || false,
  };
}

// ── Followers / Following ──

interface FollowerResult {
  users: IGProfile[];
  nextMaxId: string | null;
  hasMore: boolean;
}

export async function getFollowers(
  session: IGSession,
  userId: string,
  count = 200,
  maxId: string | null = null,
): Promise<FollowerResult> {
  let url = `${BASE}/api/v1/friendships/${userId}/followers/?count=${count}&search_surface=follow_list_page`;
  if (maxId) url += `&max_id=${maxId}`;

  const resp = await igFetch(url, session);
  const data = await resp.json();

  const users = (data.users || []).map((u: Record<string, unknown>) => ({
    id: String(u.pk || u.pk_id),
    username: u.username as string,
    fullName: u.full_name as string,
    profilePic: u.profile_pic_url as string,
    isPrivate: u.is_private as boolean,
  }));

  return {
    users,
    nextMaxId: data.next_max_id || null,
    hasMore: !!data.next_max_id,
  };
}

export async function getAllFollowers(
  session: IGSession,
  userId: string,
  limit = 500,
): Promise<IGProfile[]> {
  const all: IGProfile[] = [];
  let maxId: string | null = null;

  do {
    const result = await getFollowers(session, userId, 200, maxId);
    all.push(...result.users);
    maxId = result.nextMaxId;
    if (all.length >= limit) break;
  } while (maxId);

  return all.slice(0, limit);
}

export async function getFollowing(
  session: IGSession,
  userId: string,
  maxId: string | null = null,
): Promise<FollowerResult> {
  let url = `${BASE}/api/v1/friendships/${userId}/following/?count=200&search_surface=follow_list_page`;
  if (maxId) url += `&max_id=${maxId}`;

  const resp = await igFetch(url, session);
  const data = await resp.json();

  const users = (data.users || []).map((u: Record<string, unknown>) => ({
    id: String(u.pk || u.pk_id),
    username: u.username as string,
    fullName: u.full_name as string,
    profilePic: u.profile_pic_url as string,
    isPrivate: u.is_private as boolean,
  }));

  return {
    users,
    nextMaxId: data.next_max_id || null,
    hasMore: !!data.next_max_id,
  };
}

export async function getAllFollowing(
  session: IGSession,
  userId: string,
  limit = 500,
): Promise<IGProfile[]> {
  const all: IGProfile[] = [];
  let maxId: string | null = null;

  do {
    const result = await getFollowing(session, userId, maxId);
    all.push(...result.users);
    maxId = result.nextMaxId;
    if (all.length >= limit) break;
  } while (maxId);

  return all.slice(0, limit);
}

// ── Discover ──

export async function getSuggestedUsers(
  session: IGSession,
): Promise<IGProfile[]> {
  const url = `${BASE}/api/v1/discover/ayml/`;
  const resp = await igFetch(url, session);
  const data = await resp.json();

  const groups = data?.groups || [];
  const users: IGProfile[] = [];

  for (const group of groups) {
    for (const item of group.items || []) {
      const u = item.user;
      if (u) {
        users.push({
          id: String(u.pk || u.pk_id),
          username: u.username,
          fullName: u.full_name,
          profilePic: u.profile_pic_url,
          isPrivate: u.is_private,
          mutualFollowers: item.social_context ? 1 : 0,
        });
      }
    }
  }

  return users;
}

export async function getExploreProfiles(
  session: IGSession,
): Promise<IGProfile[]> {
  const url = `${BASE}/api/v1/discover/topical_explore/`;
  const resp = await igFetch(url, session);
  const data = await resp.json();

  const users: IGProfile[] = [];
  const items = data?.sectional_items || data?.items || [];

  for (const section of items) {
    const mediaItems = section.layout_content?.medias || [];
    for (const media of mediaItems) {
      const u = media?.media?.user;
      if (
        u &&
        !users.find((existing) => existing.id === String(u.pk || u.pk_id))
      ) {
        users.push({
          id: String(u.pk || u.pk_id),
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

// ── Posts ──

export async function getUserPosts(
  session: IGSession,
  userId: string,
  count = 6,
): Promise<IGPost[]> {
  const url = `${BASE}/api/v1/feed/user/${userId}/?count=${count}`;
  const resp = await igFetch(url, session);
  const data = await resp.json();

  return (data.items || []).map((item: Record<string, unknown>) => {
    const iv2 = item.image_versions2 as
      | { candidates?: { url: string; width: number; height: number }[] }
      | undefined;
    const candidates = iv2?.candidates || [];
    const best = candidates[0];
    const loc = item.location as {
      name: string;
      city?: string;
      lat?: number;
      lng?: number;
    } | null;
    const cap = item.caption as { text?: string } | null;
    const usertags = item.usertags as {
      in?: { user?: { username: string; pk: string } }[];
    } | null;
    const music = item.music_metadata as {
      music_info?: {
        music_asset_info?: { title: string; display_artist: string };
      };
    } | null;
    const coauthors = item.coauthor_producers as
      | { username: string; pk: string }[]
      | null;

    return {
      id: String(item.pk),
      mediaType: item.media_type as number,
      imageUrl: best?.url || null,
      imageWidth: best?.width || null,
      imageHeight: best?.height || null,
      caption: cap?.text || null,
      likeCount: (item.like_count as number) || 0,
      commentCount: (item.comment_count as number) || 0,
      playCount: (item.play_count as number) || 0,
      takenAt: item.taken_at as number,
      location: loc
        ? { name: loc.name, city: loc.city, lat: loc.lat, lng: loc.lng }
        : null,
      usertags: (usertags?.in || []).map((t) => ({
        username: t.user?.username || "",
        id: String(t.user?.pk || ""),
      })),
      musicMetadata: music?.music_info?.music_asset_info
        ? {
            title: music.music_info.music_asset_info.title,
            artist: music.music_info.music_asset_info.display_artist,
          }
        : null,
      isPaidPartnership: (item.is_paid_partnership as boolean) || false,
      productType: (item.product_type as string) || null,
      coauthors: (coauthors || []).map((c) => ({
        username: c.username,
        id: String(c.pk),
      })),
    };
  });
}

// ── DM ──

export async function sendDM(session: IGSession, userId: string, text: string) {
  const url = `${BASE}/api/v1/direct_v2/threads/broadcast/text/`;
  const body = new URLSearchParams({
    recipient_users: JSON.stringify([userId]),
    action: "send_item",
    text,
  });

  const resp = await igFetch(url, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  return { success: resp.ok, data };
}

export async function sendDMGraphQL(
  session: IGSession,
  recipientUserId: string,
  text: string,
) {
  if (!session.fbDtsg || !session.lsd) {
    return sendDM(session, recipientUserId, text);
  }

  const offlineId = String(Math.floor(Math.random() * 9e18) + 1e18);
  const variables = {
    ig_thread_igid: null,
    offline_threading_id: offlineId,
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
    fb_dtsg: session.fbDtsg,
    lsd: session.lsd,
    __a: "1",
    __user: "0",
    __comet_req: "7",
    fb_api_caller_class: "RelayModern",
    fb_api_req_friendly_name: "IGDirectTextSendMutation",
    server_timestamps: "true",
    variables: JSON.stringify(variables),
    doc_id: "25288447354146606",
  });

  const resp = await igFetch(`${BASE}/api/graphql`, session, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-fb-friendly-name": "IGDirectTextSendMutation",
    },
    body,
  });

  const data = await resp.json();
  return { success: resp.ok && !data?.errors?.length, data };
}

// ── Follow ──

export async function followUser(session: IGSession, userId: string) {
  const url = `${BASE}/api/v1/friendships/create/${userId}/`;
  const body = new URLSearchParams({
    container_module: "profile",
    user_id: userId,
  });

  const resp = await igFetch(url, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  return { success: resp.ok, data };
}

export async function unfollowUser(session: IGSession, userId: string) {
  const url = `${BASE}/api/v1/friendships/destroy/${userId}/`;
  const body = new URLSearchParams({
    container_module: "profile",
    user_id: userId,
  });

  const resp = await igFetch(url, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  return { success: resp.ok, data };
}

// ── Relationship ──

export async function checkRelationship(session: IGSession, userId: string) {
  const url = `${BASE}/api/v1/friendships/show/${userId}/`;
  const resp = await igFetch(url, session);
  const data = await resp.json();
  return {
    followedBy: !!data.followed_by,
    following: !!data.following,
    outgoingRequest: !!data.outgoing_request,
  };
}

// ── Auth ──

export async function loginToInstagram(
  username: string,
  password: string,
): Promise<{
  success: boolean;
  session?: IGSession;
  twoFactorRequired?: boolean;
  twoFactorInfo?: Record<string, unknown>;
  checkpointRequired?: boolean;
  checkpointInfo?: Record<string, unknown>;
  error?: string;
}> {
  // Step 1: Get initial CSRF token
  const initResp = await fetch(`${BASE}/accounts/login/`, {
    headers: { "user-agent": USER_AGENT },
    redirect: "manual",
  });

  const initCookies = initResp.headers.getSetCookie?.() || [];
  const allCookies: string[] = [...initCookies];
  let csrfToken = "";

  for (const c of initCookies) {
    const match = c.match(/csrftoken=([^;]+)/);
    if (match) csrfToken = match[1];
  }

  if (!csrfToken) {
    const body = await initResp.text();
    const match = body.match(/"csrf_token":"([^"]+)"/);
    if (match) csrfToken = match[1];
  }

  if (!csrfToken) {
    return { success: false, error: "Could not get CSRF token from Instagram" };
  }

  // Step 2: Login
  const timestamp = Math.floor(Date.now() / 1000);
  const loginBody = new URLSearchParams({
    username,
    enc_password: `#PWD_INSTAGRAM_BROWSER:0:${timestamp}:${password}`,
    queryParams: "{}",
    optIntoOneTap: "false",
  });

  const cookieHeader = allCookies.map((c) => c.split(";")[0]).join("; ");

  const loginResp = await fetch(`${BASE}/accounts/login/ajax/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
      "x-csrftoken": csrfToken,
      "x-requested-with": "XMLHttpRequest",
      "x-ig-app-id": APP_ID,
      cookie: cookieHeader,
      referer: `${BASE}/accounts/login/`,
      origin: BASE,
    },
    body: loginBody,
    redirect: "manual",
  });

  const loginCookies = loginResp.headers.getSetCookie?.() || [];
  allCookies.push(...loginCookies);

  const loginData = await loginResp.json();

  if (loginData.two_factor_required) {
    return {
      success: false,
      twoFactorRequired: true,
      twoFactorInfo: {
        identifier: loginData.two_factor_info?.two_factor_identifier,
        username,
        cookies: allCookies.map((c) => c.split(";")[0]).join("; "),
        csrfToken,
      },
    };
  }

  if (loginData.message === "checkpoint_required" || loginData.checkpoint_url) {
    const checkpointUrl = loginData.checkpoint_url as string;
    const fullCheckpointUrl = checkpointUrl.startsWith("http")
      ? checkpointUrl
      : `${BASE}${checkpointUrl}`;
    const cookieStr = allCookies.map((c) => c.split(";")[0]).join("; ");

    // Step 1: GET the checkpoint page to initialize it and get any new cookies
    let getBody = "";
    try {
      const getResp = await fetch(fullCheckpointUrl, {
        headers: {
          "user-agent": USER_AGENT,
          cookie: cookieStr,
          referer: `${BASE}/accounts/login/`,
        },
        redirect: "manual",
      });
      const getCookies = getResp.headers.getSetCookie?.() || [];
      allCookies.push(...getCookies);
      getBody = await getResp.text();
      console.log("[Checkpoint] Step 1 GET status:", getResp.status);
      console.log(
        "[Checkpoint] Step 1 GET body (first 500):",
        getBody.slice(0, 500),
      );
      console.log(
        "[Checkpoint] Step 1 GET cookies:",
        getCookies.length,
        "new cookies",
      );
    } catch (e) {
      console.error("[Checkpoint] Step 1 GET failed:", e);
    }

    const cookieStr2 = allCookies.map((c) => c.split(";")[0]).join("; ");
    const latestCsrf = cookieStr2.match(/csrftoken=([^;]+)/)?.[1] || csrfToken;

    // Step 2: POST choice=1 to request the code via email (choice=0 = SMS, choice=1 = email)
    try {
      const choiceResp = await fetch(fullCheckpointUrl, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": USER_AGENT,
          "x-csrftoken": latestCsrf,
          "x-requested-with": "XMLHttpRequest",
          "x-ig-app-id": APP_ID,
          cookie: cookieStr2,
          referer: fullCheckpointUrl,
          origin: BASE,
        },
        body: new URLSearchParams({ choice: "1" }),
        redirect: "manual",
      });
      const choiceCookies = choiceResp.headers.getSetCookie?.() || [];
      allCookies.push(...choiceCookies);
      const choiceBody = await choiceResp.text();
      console.log(
        "[Checkpoint] Step 2 POST choice=1 status:",
        choiceResp.status,
      );
      console.log(
        "[Checkpoint] Step 2 POST body (first 500):",
        choiceBody.slice(0, 500),
      );
      console.log(
        "[Checkpoint] Step 2 POST cookies:",
        choiceCookies.length,
        "new cookies",
      );
    } catch (e) {
      console.error("[Checkpoint] Step 2 POST failed:", e);
    }

    const finalCookieStr = allCookies.map((c) => c.split(";")[0]).join("; ");
    const finalCsrfForCheckpoint =
      finalCookieStr.match(/csrftoken=([^;]+)/)?.[1] || latestCsrf;

    return {
      success: false,
      checkpointRequired: true,
      checkpointInfo: {
        checkpointUrl,
        username,
        cookies: finalCookieStr,
        csrfToken: finalCsrfForCheckpoint,
      },
    };
  }

  if (!loginData.authenticated) {
    return {
      success: false,
      error: loginData.message || "Login failed — check credentials",
    };
  }

  // Extract session data from cookies
  const finalCookieStr = allCookies.map((c) => c.split(";")[0]).join("; ");
  const sessionId = finalCookieStr.match(/sessionid=([^;]+)/)?.[1];
  const dsUserId = finalCookieStr.match(/ds_user_id=(\d+)/)?.[1];
  const finalCsrf = finalCookieStr.match(/csrftoken=([^;]+)/)?.[1] || csrfToken;

  if (!sessionId || !dsUserId) {
    return {
      success: false,
      error: "Login succeeded but session cookies missing",
    };
  }

  return {
    success: true,
    session: {
      cookies: finalCookieStr,
      csrfToken: finalCsrf,
      userId: dsUserId,
      username,
    },
  };
}

export async function verifyTwoFactor(
  code: string,
  identifier: string,
  username: string,
  existingCookies: string,
  csrfToken: string,
): Promise<{ success: boolean; session?: IGSession; error?: string }> {
  const body = new URLSearchParams({
    username,
    verificationCode: code,
    identifier,
    queryParams: "{}",
  });

  const resp = await fetch(`${BASE}/accounts/login/ajax/two_factor/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
      "x-csrftoken": csrfToken,
      "x-requested-with": "XMLHttpRequest",
      "x-ig-app-id": APP_ID,
      cookie: existingCookies,
      referer: `${BASE}/accounts/login/`,
      origin: BASE,
    },
    body,
    redirect: "manual",
  });

  const newCookies = resp.headers.getSetCookie?.() || [];
  const data = await resp.json();

  if (!data.authenticated) {
    return { success: false, error: data.message || "Invalid 2FA code" };
  }

  const allCookieParts = [
    existingCookies,
    ...newCookies.map((c) => c.split(";")[0]),
  ];
  const finalCookieStr = allCookieParts.join("; ");
  const sessionId = finalCookieStr.match(/sessionid=([^;]+)/)?.[1];
  const dsUserId = finalCookieStr.match(/ds_user_id=(\d+)/)?.[1];
  const finalCsrf = finalCookieStr.match(/csrftoken=([^;]+)/)?.[1] || csrfToken;

  if (!sessionId || !dsUserId) {
    return { success: false, error: "2FA passed but session cookies missing" };
  }

  return {
    success: true,
    session: {
      cookies: finalCookieStr,
      csrfToken: finalCsrf,
      userId: dsUserId,
      username,
    },
  };
}

export async function verifyCheckpoint(
  code: string,
  checkpointUrl: string,
  username: string,
  existingCookies: string,
  csrfToken: string,
): Promise<{ success: boolean; session?: IGSession; error?: string }> {
  const fullUrl = checkpointUrl.startsWith("http")
    ? checkpointUrl
    : `${BASE}${checkpointUrl}`;

  const body = new URLSearchParams({
    security_code: code,
  });

  const resp = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
      "x-csrftoken": csrfToken,
      "x-requested-with": "XMLHttpRequest",
      "x-ig-app-id": APP_ID,
      cookie: existingCookies,
      referer: fullUrl,
      origin: BASE,
    },
    body,
    redirect: "manual",
  });

  const newCookies = resp.headers.getSetCookie?.() || [];
  const allCookieParts = [
    existingCookies,
    ...newCookies.map((c) => c.split(";")[0]),
  ];
  const finalCookieStr = allCookieParts.join("; ");

  // Check if we got session cookies (meaning the checkpoint passed)
  const sessionId = finalCookieStr.match(/sessionid=([^;]+)/)?.[1];
  const dsUserId = finalCookieStr.match(/ds_user_id=(\d+)/)?.[1];
  const finalCsrf = finalCookieStr.match(/csrftoken=([^;]+)/)?.[1] || csrfToken;

  if (!sessionId || !dsUserId) {
    // Try parsing the response body for an error
    let errorMsg = "Invalid security code";
    try {
      const data = await resp.json();
      if (data.message) errorMsg = data.message;
    } catch {
      // Response might be HTML on success with redirect
      if (resp.status === 302 || resp.status === 301) {
        // Redirect usually means success — follow it to get cookies
        const redirectUrl = resp.headers.get("location");
        if (redirectUrl) {
          const followResp = await fetch(
            redirectUrl.startsWith("http")
              ? redirectUrl
              : `${BASE}${redirectUrl}`,
            {
              headers: {
                "user-agent": USER_AGENT,
                cookie: finalCookieStr,
              },
              redirect: "manual",
            },
          );
          const moreCookies = followResp.headers.getSetCookie?.() || [];
          const fullCookieStr = [
            finalCookieStr,
            ...moreCookies.map((c) => c.split(";")[0]),
          ].join("; ");
          const sid = fullCookieStr.match(/sessionid=([^;]+)/)?.[1];
          const uid = fullCookieStr.match(/ds_user_id=(\d+)/)?.[1];
          const csrf =
            fullCookieStr.match(/csrftoken=([^;]+)/)?.[1] || finalCsrf;

          if (sid && uid) {
            return {
              success: true,
              session: {
                cookies: fullCookieStr,
                csrfToken: csrf,
                userId: uid,
                username,
              },
            };
          }
        }
      }
    }
    return { success: false, error: errorMsg };
  }

  return {
    success: true,
    session: {
      cookies: finalCookieStr,
      csrfToken: finalCsrf,
      userId: dsUserId,
      username,
    },
  };
}

// ── Reels Discovery ──

export interface ReelInfo {
  mediaId: string;
  shortcode: string;
  videoUrl: string | null;
  username: string | null;
  caption: string;
  viewCount: number;
  likeCount: number;
}

export async function getReelsFeed(
  session: IGSession,
  amount = 10,
): Promise<ReelInfo[]> {
  // Best strategy: fetch feeds from a few public followers and filter for reels (product_type=clips).
  // The clips/reels_tray endpoint returns stories (not reels) and explore can fail with useragent mismatch.
  const reels: ReelInfo[] = [];

  try {
    const { users } = await getFollowers(session, session.userId, 20);
    const publicUsers = users.filter((u) => !u.isPrivate).slice(0, 5);

    for (const user of publicUsers) {
      if (reels.length >= amount) break;
      try {
        const posts = await getUserPosts(session, user.id, 6);
        for (const post of posts) {
          if (
            post.productType === "clips" ||
            (post.mediaType === 2 && post.playCount != null)
          ) {
            reels.push({
              mediaId: post.id,
              shortcode: "",
              videoUrl: null,
              username: user.username,
              caption: post.caption || "",
              viewCount: post.playCount || 0,
              likeCount: post.likeCount || 0,
            });
          }
        }
      } catch {
        /* skip user on error */
      }
    }
  } catch (e) {
    console.warn("[Reels] Follower-based reel discovery failed:", e);
  }

  return reels.slice(0, amount);
}

export async function getExploreReels(session: IGSession): Promise<ReelInfo[]> {
  const reels: ReelInfo[] = [];

  // Try explore endpoint first
  try {
    const url = `${BASE}/api/v1/discover/topical_explore/?is_prefetch=false&omit_cover_media=true`;
    const resp = await igFetch(url, session);
    if (resp.ok) {
      const data = await resp.json();
      const items = data?.sectional_items || data?.items || [];
      for (const section of items) {
        for (const media of section.layout_content?.medias || []) {
          const m = media?.media;
          if (m && m.media_type === 2 && m.video_versions?.length) {
            reels.push({
              mediaId: String(m.pk),
              shortcode: m.code || "",
              videoUrl: m.video_versions[0]?.url || null,
              username: m.user?.username || null,
              caption: m.caption?.text || "",
              viewCount: m.view_count || 0,
              likeCount: m.like_count || 0,
            });
          }
        }
      }
    }
  } catch {
    /* ignore explore failures */
  }

  // If explore returned nothing, fall back to follower feed reels
  if (!reels.length) {
    return getReelsFeed(session, 10);
  }

  return reels;
}

export async function getMediaInfo(
  session: IGSession,
  shortcodeOrId: string,
): Promise<{
  mediaId: string;
  videoUrl: string | null;
  username: string | null;
  caption: string;
} | null> {
  const isNumeric = /^\d+$/.test(shortcodeOrId);

  // If shortcode, first resolve to media ID
  let mediaId = shortcodeOrId;
  if (!isNumeric) {
    const resolved = await getMediaId(session, shortcodeOrId);
    if (!resolved) return null;
    mediaId = resolved;
  }

  const resp = await igFetch(`${BASE}/api/v1/media/${mediaId}/info/`, session);
  if (!resp.ok) return null;

  const data = await resp.json();
  const item = data.items?.[0];
  if (!item) return null;

  return {
    mediaId: String(item.pk),
    videoUrl: item.video_versions?.[0]?.url || null,
    username: item.user?.username || null,
    caption: item.caption?.text || "",
  };
}

export async function getRandomReel(
  session: IGSession,
): Promise<ReelInfo | null> {
  // Try reels feed first, fall back to explore
  let reels = await getReelsFeed(session);
  if (!reels.length) {
    reels = await getExploreReels(session);
  }
  if (!reels.length) return null;
  return reels[Math.floor(Math.random() * reels.length)];
}

// ── Story Upload ──

export async function uploadStoryPhoto(
  session: IGSession,
  jpegData: ArrayBuffer,
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  // Step 1: Upload photo via rupload (same as regular photo upload)
  const uploadResult = await uploadPhoto(session, jpegData);
  if (!uploadResult.success || !uploadResult.uploadId) {
    return { success: false, error: uploadResult.error || "Upload failed" };
  }

  // Step 2: Configure as story (not feed post)
  const configUrl = `${BASE}/api/v1/media/configure_to_story/`;
  const body = new URLSearchParams({
    upload_id: uploadResult.uploadId,
    source_type: "4",
    configure_mode: "1",
  });

  const resp = await igFetch(configUrl, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  if (!resp.ok) {
    return { success: false, error: `Story configure failed: ${resp.status}` };
  }

  return { success: true, mediaId: data.media?.id };
}

export async function uploadStoryVideo(
  session: IGSession,
  videoData: ArrayBuffer,
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  // Step 1: Upload video via rupload_igvideo
  const uploadId = String(Math.floor(Date.now() / 1000));
  const entityName = `${uploadId}_0_${Math.floor(Math.random() * 9e9) + 1e9}`;

  const ruploadParams = JSON.stringify({
    retry_context: JSON.stringify({
      num_step_auto_retry: 0,
      num_reupload: 0,
      num_step_manual_retry: 0,
    }),
    media_type: 2,
    upload_id: uploadId,
    xsharing_user_ids: "[]",
    upload_media_duration_ms: "0",
    upload_media_width: "1080",
    upload_media_height: "1920",
  });

  const headers = {
    ...buildHeaders(session),
    "x-instagram-rupload-params": ruploadParams,
    "x-entity-name": entityName,
    "x-entity-length": String(videoData.byteLength),
    "x-entity-type": "video/mp4",
    "content-type": "video/mp4",
    offset: "0",
    "sec-fetch-site": "same-site",
  };

  const uploadResp = await fetch(
    `https://i.instagram.com/rupload_igvideo/${entityName}`,
    {
      method: "POST",
      headers,
      body: videoData,
    },
  );

  if (!uploadResp.ok) {
    return {
      success: false,
      error: `Video upload failed: ${uploadResp.status}`,
    };
  }

  // Step 2: Configure as story
  const configUrl = `${BASE}/api/v1/media/configure_to_story/`;
  const body = new URLSearchParams({
    upload_id: uploadId,
    source_type: "4",
    configure_mode: "1",
  });

  const configResp = await igFetch(configUrl, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await configResp.json();
  if (!configResp.ok) {
    return {
      success: false,
      error: `Story video configure failed: ${configResp.status}`,
    };
  }

  return { success: true, mediaId: data.media?.id };
}

export async function repostReelToStory(
  session: IGSession,
  shortcode: string,
): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  // Step 1: Get the reel video URL
  const info = await getMediaInfo(session, shortcode);
  if (!info?.videoUrl) {
    return { success: false, error: "Could not get reel video URL" };
  }

  // Step 2: Download the video
  const videoResp = await fetch(info.videoUrl);
  if (!videoResp.ok) {
    return {
      success: false,
      error: `Video download failed: ${videoResp.status}`,
    };
  }
  const videoData = await videoResp.arrayBuffer();

  // Step 3: Upload as story
  return uploadStoryVideo(session, videoData);
}

// ── Profile Pipeline ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function filterAndDedupe(
  profiles: IGProfile[],
  seen: Set<string>,
  currentUserId: string,
): IGProfile[] {
  const unseen = profiles.filter((p) => {
    if (seen.has(p.id)) return false;
    if (p.isPrivate) return false;
    if (p.id === currentUserId) return false;
    return true;
  });

  const uniqueMap = new Map<string, IGProfile>();
  for (const p of unseen) {
    if (!uniqueMap.has(p.id)) uniqueMap.set(p.id, p);
  }
  return [...uniqueMap.values()];
}

export async function enrichProfiles(
  session: IGSession,
  profiles: IGProfile[],
  limit = 20,
): Promise<IGProfile[]> {
  const enriched: IGProfile[] = [];
  for (const p of profiles.slice(0, limit)) {
    try {
      const full = await getProfileInfo(session, p.username);
      if (full) {
        try {
          full.recentPosts = await getUserPosts(session, full.id, 6);
        } catch {
          full.recentPosts = [];
        }
        enriched.push(full);
      } else {
        enriched.push(p);
      }
    } catch {
      enriched.push(p);
    }
  }
  return enriched;
}

export async function loadProfilesFast(
  session: IGSession,
  seen: Set<string>,
  sources: { suggested: boolean; explore: boolean; friendsOfFriends: boolean },
): Promise<IGProfile[]> {
  const allProfiles: IGProfile[] = [];

  // Tier 1: Followers — single API call, no enrichment
  try {
    const result = await getFollowers(session, session.userId, 50);
    const tier1 = filterAndDedupe(result.users, seen, session.userId);
    allProfiles.push(...tier1);
  } catch (e) {
    console.warn("[Profiles] Tier 1 (followers) failed:", e);
  }

  // Tier 2: Suggested — single API call, no enrichment
  if (sources.suggested) {
    try {
      const suggested = await getSuggestedUsers(session);
      const tier2 = filterAndDedupe(suggested, seen, session.userId);
      allProfiles.push(...tier2);
    } catch (e) {
      console.warn("[Profiles] Tier 2 (suggested) failed:", e);
    }
  }

  // Tier 3: Explore — single API call, no enrichment
  if (sources.explore) {
    try {
      const explore = await getExploreProfiles(session);
      const tier3 = filterAndDedupe(explore, seen, session.userId);
      allProfiles.push(...tier3);
    } catch (e) {
      console.warn("[Profiles] Tier 3 (explore) failed:", e);
    }
  }

  return allProfiles;
}

export async function enrichSingleProfile(
  session: IGSession,
  username: string,
): Promise<IGProfile | null> {
  const full = await getProfileInfo(session, username);
  if (!full) return null;
  try {
    full.recentPosts = await getUserPosts(session, full.id, 6);
  } catch {
    full.recentPosts = [];
  }
  return full;
}

// ── Comments ──

export async function commentOnPost(
  session: IGSession,
  mediaId: string,
  text: string,
) {
  const url = `${BASE}/api/v1/web/comments/${mediaId}/add/`;
  const body = new URLSearchParams({ comment_text: text });

  const resp = await igFetch(url, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  return { success: resp.ok, data };
}

// ── Media ID Resolution ──

export async function getMediaId(
  session: IGSession,
  shortcode: string,
): Promise<string | null> {
  const url = `${BASE}/api/v1/media/${shortcode}/media_id/`;
  try {
    const resp = await igFetch(url, session);
    if (resp.ok) {
      const data = await resp.json();
      return data.media_id || null;
    }
  } catch {
    /* fall through */
  }

  // Fallback to /info/ endpoint
  try {
    const infoUrl = `${BASE}/api/v1/media/${shortcode}/info/`;
    const resp = await igFetch(infoUrl, session);
    if (resp.ok) {
      const data = await resp.json();
      return data.items?.[0]?.pk ? String(data.items[0].pk) : null;
    }
  } catch {
    /* empty */
  }

  return null;
}

// ── Bulk Relationship Check ──

export async function checkRelationshipBulk(
  session: IGSession,
  userIds: string[],
): Promise<
  Record<
    string,
    { followedBy: boolean; following: boolean; outgoingRequest: boolean }
  >
> {
  const url = `${BASE}/api/v1/friendships/show_many/`;
  const body = new URLSearchParams({ user_ids: userIds.join(",") });

  const resp = await igFetch(url, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  const statuses = data.friendship_statuses || {};
  const result: Record<
    string,
    { followedBy: boolean; following: boolean; outgoingRequest: boolean }
  > = {};

  for (const [id, status] of Object.entries(statuses)) {
    const s = status as Record<string, boolean>;
    result[id] = {
      followedBy: !!s.followed_by,
      following: !!s.following,
      outgoingRequest: !!s.outgoing_request,
    };
  }

  return result;
}

// ── Photo Upload + Post ──

export async function uploadPhoto(
  session: IGSession,
  jpegData: ArrayBuffer,
): Promise<{ success: boolean; uploadId?: string; error?: string }> {
  const uploadId = String(Math.floor(Date.now() / 1000));
  const entityName = `${uploadId}_0_${Math.floor(Math.random() * 9e9) + 1e9}`;

  const ruploadParams = JSON.stringify({
    retry_context: JSON.stringify({
      num_step_auto_retry: 0,
      num_reupload: 0,
      num_step_manual_retry: 0,
    }),
    media_type: 1,
    upload_id: uploadId,
    image_compression: JSON.stringify({
      lib_name: "moz",
      lib_version: "3.1.m",
      quality: "80",
    }),
    xsharing_user_ids: "[]",
  });

  const headers = {
    ...buildHeaders(session),
    "x-instagram-rupload-params": ruploadParams,
    "x-entity-name": entityName,
    "x-entity-length": String(jpegData.byteLength),
    "x-entity-type": "image/jpeg",
    "content-type": "image/jpeg",
    offset: "0",
    "sec-fetch-site": "same-site",
  };

  const resp = await fetch(
    `https://i.instagram.com/rupload_igphoto/${entityName}`,
    {
      method: "POST",
      headers,
      body: jpegData,
    },
  );

  if (!resp.ok) {
    return { success: false, error: `Upload failed: ${resp.status}` };
  }

  return { success: true, uploadId };
}

export async function publishPost(
  session: IGSession,
  uploadId: string,
  caption: string,
): Promise<{
  success: boolean;
  mediaId?: string;
  code?: string;
  error?: string;
}> {
  const url = `${BASE}/api/v1/media/configure/`;
  const body = new URLSearchParams({
    upload_id: uploadId,
    caption,
    source_type: "4",
  });

  const resp = await igFetch(url, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  if (!resp.ok) {
    return { success: false, error: `Configure failed: ${resp.status}` };
  }

  return {
    success: true,
    mediaId: data.media?.id,
    code: data.media?.code,
  };
}

// ── Profile Edit ──

export async function getProfileFormData(
  session: IGSession,
): Promise<Record<string, string> | null> {
  const url = `${BASE}/api/v1/accounts/edit/web_form_data/`;
  const resp = await igFetch(url, session);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.form_data || null;
}

export async function editProfile(
  session: IGSession,
  fields: Record<string, string>,
): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  // Fetch current values first so we don't blank out fields
  const current = await getProfileFormData(session);

  const payload: Record<string, string> = current
    ? {
        biography: current.biography || "",
        chaining_enabled: "on",
        external_url: current.external_url || "",
        first_name: current.first_name || "",
        username: current.username || "",
        ...(current.email ? { email: current.email } : {}),
        ...(current.phone_number ? { phone_number: current.phone_number } : {}),
      }
    : {};

  Object.assign(payload, fields);

  const url = `${BASE}/api/v1/web/accounts/edit/`;
  const body = new URLSearchParams(payload);

  const resp = await igFetch(url, session, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await resp.json();
  return { success: resp.ok, data };
}

// ── Profile Picture ──

export async function changeProfilePicture(
  session: IGSession,
  imageData: ArrayBuffer,
  filename = "profile_pic.jpg",
): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const url = `${BASE}/api/v1/web/accounts/web_change_profile_picture/`;

  const formData = new FormData();
  formData.append(
    "profile_pic",
    new Blob([imageData], { type: "image/jpeg" }),
    filename,
  );

  // Strip content-type so fetch sets the multipart boundary automatically
  const headers = buildHeaders(session);
  delete headers["content-type"];

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!resp.ok) {
    return {
      success: false,
      error: `Profile pic change failed: ${resp.status}`,
    };
  }

  const data = await resp.json();
  return { success: true, data };
}
