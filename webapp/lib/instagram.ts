import type { IGProfile, IGPost, IGSession } from "./types";
import { rateLimit, backoff429 } from "./rate-limiter";

const APP_ID = "936619743392459";
const BASE = "https://www.instagram.com";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function buildHeaders(session: IGSession): Record<string, string> {
  return {
    "x-ig-app-id": APP_ID,
    "x-requested-with": "XMLHttpRequest",
    "x-csrftoken": session.csrfToken,
    cookie: session.cookies,
    "user-agent": USER_AGENT,
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
    headers: { ...buildHeaders(session), ...(options.headers as Record<string, string> || {}) },
  });

  if (resp.status === 429) {
    console.warn("[IG] Rate limited — backing off 30s");
    await backoff429();
    return igFetch(url, session, options);
  }

  return resp;
}

// ── Profile ──

export async function getProfileInfo(session: IGSession, username: string): Promise<IGProfile | null> {
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

  return { users, nextMaxId: data.next_max_id || null, hasMore: !!data.next_max_id };
}

export async function getAllFollowers(session: IGSession, userId: string, limit = 500): Promise<IGProfile[]> {
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

  return { users, nextMaxId: data.next_max_id || null, hasMore: !!data.next_max_id };
}

export async function getAllFollowing(session: IGSession, userId: string, limit = 500): Promise<IGProfile[]> {
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

export async function getSuggestedUsers(session: IGSession): Promise<IGProfile[]> {
  const url = `${BASE}/api/v1/discover/ayml/`;
  const resp = await igFetch(url, session);
  const data = await resp.json();

  const groups = data?.groups || [];
  const users: IGProfile[] = [];

  for (const group of groups) {
    for (const item of (group.items || [])) {
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

export async function getExploreProfiles(session: IGSession): Promise<IGProfile[]> {
  const url = `${BASE}/api/v1/discover/topical_explore/`;
  const resp = await igFetch(url, session);
  const data = await resp.json();

  const users: IGProfile[] = [];
  const items = data?.sectional_items || data?.items || [];

  for (const section of items) {
    const mediaItems = section.layout_content?.medias || [];
    for (const media of mediaItems) {
      const u = media?.media?.user;
      if (u && !users.find((existing) => existing.id === String(u.pk || u.pk_id))) {
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

export async function getUserPosts(session: IGSession, userId: string, count = 6): Promise<IGPost[]> {
  const url = `${BASE}/api/v1/feed/user/${userId}/?count=${count}`;
  const resp = await igFetch(url, session);
  const data = await resp.json();

  return (data.items || []).map((item: Record<string, unknown>) => {
    const iv2 = item.image_versions2 as { candidates?: { url: string; width: number; height: number }[] } | undefined;
    const candidates = iv2?.candidates || [];
    const best = candidates[0];
    const loc = item.location as { name: string; city?: string; lat?: number; lng?: number } | null;
    const cap = item.caption as { text?: string } | null;
    const usertags = item.usertags as { in?: { user?: { username: string; pk: string } }[] } | null;
    const music = item.music_metadata as { music_info?: { music_asset_info?: { title: string; display_artist: string } } } | null;
    const coauthors = item.coauthor_producers as { username: string; pk: string }[] | null;

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
      location: loc ? { name: loc.name, city: loc.city, lat: loc.lat, lng: loc.lng } : null,
      usertags: (usertags?.in || []).map((t) => ({
        username: t.user?.username || "",
        id: String(t.user?.pk || ""),
      })),
      musicMetadata: music?.music_info?.music_asset_info
        ? { title: music.music_info.music_asset_info.title, artist: music.music_info.music_asset_info.display_artist }
        : null,
      isPaidPartnership: (item.is_paid_partnership as boolean) || false,
      productType: (item.product_type as string) || null,
      coauthors: (coauthors || []).map((c) => ({ username: c.username, id: String(c.pk) })),
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

export async function sendDMGraphQL(session: IGSession, recipientUserId: string, text: string) {
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
  const body = new URLSearchParams({ container_module: "profile", user_id: userId });

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
  const body = new URLSearchParams({ container_module: "profile", user_id: userId });

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
): Promise<{ success: boolean; session?: IGSession; twoFactorRequired?: boolean; twoFactorInfo?: Record<string, unknown>; error?: string }> {
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

  if (!loginData.authenticated) {
    return { success: false, error: loginData.message || "Login failed — check credentials" };
  }

  // Extract session data from cookies
  const finalCookieStr = allCookies.map((c) => c.split(";")[0]).join("; ");
  const sessionId = finalCookieStr.match(/sessionid=([^;]+)/)?.[1];
  const dsUserId = finalCookieStr.match(/ds_user_id=(\d+)/)?.[1];
  const finalCsrf = finalCookieStr.match(/csrftoken=([^;]+)/)?.[1] || csrfToken;

  if (!sessionId || !dsUserId) {
    return { success: false, error: "Login succeeded but session cookies missing" };
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

  const allCookieParts = [existingCookies, ...newCookies.map((c) => c.split(";")[0])];
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

// ── Profile Pipeline ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function filterAndDedupe(profiles: IGProfile[], seen: Set<string>, currentUserId: string): IGProfile[] {
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

export async function enrichProfiles(session: IGSession, profiles: IGProfile[], limit = 20): Promise<IGProfile[]> {
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

export async function loadProfilePipeline(
  session: IGSession,
  seen: Set<string>,
  sources: { suggested: boolean; explore: boolean; friendsOfFriends: boolean },
): Promise<IGProfile[]> {
  const allProfiles: IGProfile[] = [];

  // Tier 1: Followers
  try {
    const followers = await getAllFollowers(session, session.userId, 200);
    const tier1 = filterAndDedupe(followers, seen, session.userId);
    if (tier1.length > 0) {
      const enriched = await enrichProfiles(session, tier1);
      allProfiles.push(...enriched);
    }
  } catch (e) {
    console.warn("[Profiles] Tier 1 (followers) failed:", e);
  }

  // Tier 2: Friends of friends
  if (sources.friendsOfFriends) {
    try {
      const following = await getAllFollowing(session, session.userId, 500);
      const sampled = shuffle(following).slice(0, 10);
      const fofProfiles: IGProfile[] = [];

      for (const f of sampled) {
        try {
          const result = await getFollowers(session, f.id, 25);
          fofProfiles.push(...result.users);
        } catch {
          // skip
        }
      }

      const tier2 = filterAndDedupe(fofProfiles, seen, session.userId);
      if (tier2.length > 0) {
        const enriched = await enrichProfiles(session, tier2);
        allProfiles.push(...enriched);
      }
    } catch (e) {
      console.warn("[Profiles] Tier 2 (FoF) failed:", e);
    }
  }

  // Tier 3: Suggested
  if (sources.suggested) {
    try {
      const suggested = await getSuggestedUsers(session);
      const tier3 = filterAndDedupe(suggested, seen, session.userId);
      if (tier3.length > 0) {
        const enriched = await enrichProfiles(session, tier3);
        allProfiles.push(...enriched);
      }
    } catch (e) {
      console.warn("[Profiles] Tier 3 (suggested) failed:", e);
    }
  }

  return allProfiles;
}
