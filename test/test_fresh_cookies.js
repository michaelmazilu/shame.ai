#!/usr/bin/env node
/**
 * Test all new TS functions with fresh cookies.
 */

const fs = require("fs");
const path = require("path");

// Fresh cookies from user
const CSRF = "aef5n9DG5ifAgaUtj00q0KBwRJkyOmpU";
const USER_ID = "55930673140";
const COOKIE = [
  "csrftoken=aef5n9DG5ifAgaUtj00q0KBwRJkyOmpU",
  "datr=PAWvaPyrDTSBn04IodINYjLC",
  "ds_user_id=55930673140",
  "ig_did=08D4EBAE-5668-4341-9172-A19EC8723A72",
  "ig_nrcb=1",
  "mid=aDFdrQAEAAFaeFJmOAOwXFYTEir4",
  "ps_l=1",
  "ps_n=1",
  "sessionid=55930673140%3AWwLBBjqSKN8eQ5%3A13%3AAYi7r4KPl_fJIN5PUvIHbkB13C_7CQH3PWZ-WcIk6Q",
  "wd=579x878",
].join("; ");

// Load Azure keys from .env
const envPath = path.resolve(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq < 0) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const BASE = "https://www.instagram.com";
const headers = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  "x-asbd-id": "359341",
  "x-ig-app-id": "936619743392459",
  "x-ig-www-claim": "",
  "x-instagram-ajax": "1036193752",
  "x-csrftoken": CSRF,
  "x-requested-with": "XMLHttpRequest",
  cookie: COOKIE,
  referer: "https://www.instagram.com/",
  origin: "https://www.instagram.com",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

let passed = 0;
let failed = 0;

async function run(name, fn) {
  console.log(`\n=== ${name} ===`);
  try {
    const ok = await fn();
    if (ok) {
      passed++;
      console.log("  PASS");
    } else {
      failed++;
      console.log("  FAIL");
    }
  } catch (e) {
    failed++;
    console.log(`  ERROR: ${e.message}`);
  }
}

async function main() {
  // 1. Session check
  await run("1. Session Check (profile fetch)", async () => {
    const resp = await fetch(
      `${BASE}/api/v1/users/web_profile_info/?username=instagram`,
      { headers, redirect: "manual" },
    );
    console.log(`  Status: ${resp.status}`);
    if (resp.status !== 200) {
      const t = await resp.text();
      console.log("  Body:", t.slice(0, 200));
      return false;
    }
    const d = await resp.json();
    console.log(
      `  Username: ${d.data?.user?.username}, Followers: ${d.data?.user?.edge_followed_by?.count}`,
    );
    return !!d.data?.user;
  });

  // 2. Reels tray
  await run("2. Reels Tray (feed/reels_tray)", async () => {
    const resp = await fetch(`${BASE}/api/v1/feed/reels_tray/`, {
      headers,
      redirect: "manual",
    });
    console.log(`  Status: ${resp.status}`);
    if (resp.status !== 200) {
      const t = await resp.text();
      console.log("  Body:", t.slice(0, 200));
      return false;
    }
    const d = await resp.json();
    console.log(`  Tray entries: ${d.tray?.length}`);
    let videos = 0;
    for (const t of d.tray || []) {
      for (const item of t.items || []) {
        if (item.video_versions?.length) videos++;
      }
    }
    console.log(`  Video items in trays: ${videos}`);
    return d.tray?.length > 0;
  });

  // 3. Explore page
  await run("3. Explore Page (topical_explore)", async () => {
    const resp = await fetch(
      `${BASE}/api/v1/discover/topical_explore/?is_prefetch=false&omit_cover_media=true`,
      { headers, redirect: "manual" },
    );
    console.log(`  Status: ${resp.status}`);
    if (resp.status !== 200) {
      const t = await resp.text();
      console.log("  Body:", t.slice(0, 200));
      return false;
    }
    const d = await resp.json();
    const items = d.sectional_items || d.items || [];
    let reels = 0;
    for (const s of items) {
      for (const m of s.layout_content?.medias || []) {
        if (m?.media?.media_type === 2) reels++;
      }
    }
    console.log(`  Sections: ${items.length}, Reels/videos: ${reels}`);
    return items.length > 0;
  });

  // 4. Media info
  await run("4. Media Info (own feed -> info)", async () => {
    const feedResp = await fetch(
      `${BASE}/api/v1/feed/user/${USER_ID}/?count=6`,
      {
        headers,
        redirect: "manual",
      },
    );
    console.log(`  Feed status: ${feedResp.status}`);
    if (feedResp.status !== 200) return false;
    const feedData = await feedResp.json();
    const item = feedData.items?.[0];
    if (!item) {
      console.log("  No posts found, skipping");
      return true;
    }
    const resp = await fetch(`${BASE}/api/v1/media/${item.pk}/info/`, {
      headers,
      redirect: "manual",
    });
    console.log(`  Info status: ${resp.status}`);
    if (resp.status !== 200) return false;
    const d = await resp.json();
    const mi = d.items?.[0];
    console.log(
      `  PK: ${mi?.pk}, User: ${mi?.user?.username}, Type: ${mi?.media_type}, HasVideo: ${!!mi?.video_versions?.length}`,
    );
    return !!mi;
  });

  // 5. Azure FLUX image gen
  await run("5. Azure FLUX Image Gen", async () => {
    if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
      console.log("  SKIP: Azure not configured");
      return true;
    }
    const ep = env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
    const url = `${ep}/openai/deployments/FLUX.1-Kontext-pro/images/generations?api-version=2025-04-01-preview`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": env.AZURE_OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "A silly cat wearing a tiny top hat, cartoon style",
        size: "1024x1024",
        n: 1,
      }),
    });
    console.log(`  Status: ${resp.status}`);
    if (!resp.ok) {
      console.log("  Error:", (await resp.text()).slice(0, 200));
      return false;
    }
    const d = await resp.json();
    const img = d.data?.[0];
    console.log(`  Has URL: ${!!img?.url}, Has B64: ${!!img?.b64_json}`);
    return !!(img?.url || img?.b64_json);
  });

  // 6. Azure GPT confession
  await run("6. Azure GPT Love Confession", async () => {
    if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
      console.log("  SKIP: Azure not configured");
      return true;
    }
    const ep = env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
    const url = `${ep}/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2024-12-01-preview`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": env.AZURE_OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You write short, flirty Instagram DMs. Keep it under 2 sentences.",
          },
          {
            role: "user",
            content:
              "Write a love confession DM. Their name is TestUser (Instagram: @testuser).",
          },
        ],
        max_tokens: 100,
        temperature: 0.9,
      }),
    });
    console.log(`  Status: ${resp.status}`);
    if (!resp.ok) {
      console.log("  Error:", (await resp.text()).slice(0, 200));
      return false;
    }
    const d = await resp.json();
    const text = d.choices?.[0]?.message?.content?.trim();
    console.log(`  Generated: "${text}"`);
    return !!text;
  });

  // 7. Azure GPT reel comment
  await run("7. Azure GPT Reel Comment", async () => {
    if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
      console.log("  SKIP: Azure not configured");
      return true;
    }
    const ep = env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
    const url = `${ep}/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2024-12-01-preview`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": env.AZURE_OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content:
              "You write short, funny Instagram comments on reels. Keep it to 1 sentence max. Be witty. No hashtags.",
          },
          {
            role: "user",
            content:
              'Write a comment for this reel. The reel is by @foodie_chef. Caption: "POV: when the recipe actually works"',
          },
        ],
        max_tokens: 60,
        temperature: 0.9,
      }),
    });
    console.log(`  Status: ${resp.status}`);
    if (!resp.ok) return false;
    const d = await resp.json();
    const text = d.choices?.[0]?.message?.content?.trim();
    console.log(`  Generated: "${text}"`);
    return !!text;
  });

  console.log(`\n========================================`);
  console.log(`  Results: ${passed} passed, ${failed} failed out of 7`);
  console.log(`========================================`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
