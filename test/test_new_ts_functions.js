#!/usr/bin/env node
/**
 * Test the new TypeScript functions ported from Python.
 * Uses credentials from root .env (same as Python tests).
 *
 * Usage: node test/test_new_ts_functions.js [test_name]
 *   test_name: reels | explore-reels | media-info | image-gen | confession | reel-comment | all
 */

const fs = require("fs");
const path = require("path");

// Load .env from project root
const envPath = path.resolve(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  env[key] = val;
}

const BASE = "https://www.instagram.com";
const APP_ID = "936619743392459";
const USER_AGENT =
  env.USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function buildHeaders() {
  return {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "user-agent": USER_AGENT,
    "x-ig-app-id": APP_ID,
    "x-csrftoken": env.ACCOUNT1_CSRFTOKEN,
    cookie: env.ACCOUNT1_COOKIES,
    referer: "https://www.instagram.com/",
    origin: "https://www.instagram.com",
    "x-requested-with": "XMLHttpRequest",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  };
}

// ── Test: Reels Feed ──
async function testReelsFeed() {
  console.log("\n=== Testing Reels Feed (getReelsFeed) ===");
  const url = `${BASE}/api/v1/clips/reels_tray/`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      ...buildHeaders(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ page_size: "5" }),
  });
  console.log(`  Status: ${resp.status}`);
  const data = await resp.json();
  const reels = [];
  for (const tray of data.tray || []) {
    for (const item of tray.items || []) {
      if (item.media_type === 2 && item.video_versions?.length) {
        reels.push({
          mediaId: String(item.pk),
          shortcode: item.code,
          username: item.user?.username,
          hasVideo: !!item.video_versions[0]?.url,
        });
      }
    }
  }
  console.log(`  Found ${reels.length} reels from feed`);
  if (reels.length > 0) {
    console.log(
      `  Sample: @${reels[0].username} — ${reels[0].shortcode} (video: ${reels[0].hasVideo})`,
    );
  }
  return reels.length > 0;
}

// ── Test: Explore Reels ──
async function testExploreReels() {
  console.log("\n=== Testing Explore Reels (getExploreReels) ===");
  const url = `${BASE}/api/v1/discover/topical_explore/`;
  const resp = await fetch(url, { headers: buildHeaders() });
  console.log(`  Status: ${resp.status}`);
  const data = await resp.json();
  const reels = [];
  const items = data?.sectional_items || data?.items || [];
  for (const section of items) {
    for (const media of section.layout_content?.medias || []) {
      const m = media?.media;
      if (m && m.media_type === 2 && m.video_versions?.length) {
        reels.push({
          mediaId: String(m.pk),
          shortcode: m.code,
          username: m.user?.username,
        });
      }
    }
  }
  console.log(`  Found ${reels.length} reels from explore`);
  if (reels.length > 0) {
    console.log(`  Sample: @${reels[0].username} — ${reels[0].shortcode}`);
  }
  return reels.length > 0;
}

// ── Test: Media Info ──
async function testMediaInfo() {
  console.log("\n=== Testing Media Info (getMediaInfo) ===");
  // First get a reel to test with
  const feedUrl = `${BASE}/api/v1/clips/reels_tray/`;
  const feedResp = await fetch(feedUrl, {
    method: "POST",
    headers: {
      ...buildHeaders(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ page_size: "3" }),
  });
  const feedData = await feedResp.json();
  let testId = null;
  for (const tray of feedData.tray || []) {
    for (const item of tray.items || []) {
      if (item.pk) {
        testId = String(item.pk);
        break;
      }
    }
    if (testId) break;
  }
  if (!testId) {
    console.log("  SKIP: No reel found to test media info");
    return true;
  }

  const resp = await fetch(`${BASE}/api/v1/media/${testId}/info/`, {
    headers: buildHeaders(),
  });
  console.log(`  Status: ${resp.status}`);
  const data = await resp.json();
  const item = data.items?.[0];
  if (item) {
    console.log(`  Media PK: ${item.pk}`);
    console.log(`  Username: ${item.user?.username}`);
    console.log(`  Has video URL: ${!!item.video_versions?.[0]?.url}`);
    console.log(`  Caption: ${(item.caption?.text || "").slice(0, 60)}...`);
    return true;
  }
  console.log("  FAIL: No media info returned");
  return false;
}

// ── Test: Azure Image Gen ──
async function testImageGen() {
  console.log("\n=== Testing Image Gen (Azure FLUX) ===");
  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
    console.log(
      "  SKIP: AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_KEY not set",
    );
    return true;
  }
  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  const url = `${endpoint}/openai/deployments/FLUX.1-Kontext-pro/images/generations?api-version=2025-04-01-preview`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": env.AZURE_OPENAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: "A cartoon potato wearing sunglasses",
      size: "1024x1024",
      n: 1,
    }),
  });
  console.log(`  Status: ${resp.status}`);
  if (resp.ok) {
    const data = await resp.json();
    const img = data.data?.[0];
    console.log(`  Has image URL: ${!!img?.url}`);
    console.log(`  Has base64: ${!!img?.b64_json}`);
    console.log(
      `  Revised prompt: ${img?.revised_prompt?.slice(0, 60) || "none"}...`,
    );
    return true;
  }
  const body = await resp.text();
  console.log(`  Error: ${body.slice(0, 200)}`);
  return false;
}

// ── Test: Azure Confession Gen ──
async function testConfession() {
  console.log("\n=== Testing Confession Gen (Azure GPT) ===");
  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
    console.log("  SKIP: Azure keys not set");
    return true;
  }
  // Use the same endpoint pattern as the webapp's azure.ts
  // The webapp uses AZURE_ENDPOINT (chat completions), not AZURE_OPENAI_ENDPOINT (resource base)
  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  const chatUrl = `${endpoint}/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2024-12-01-preview`;
  const resp = await fetch(chatUrl, {
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
  if (resp.ok) {
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    console.log(`  Generated: "${text}"`);
    return !!text;
  }
  const body = await resp.text();
  console.log(`  Error: ${body.slice(0, 200)}`);
  return false;
}

// ── Test: Azure Reel Comment Gen ──
async function testReelCommentGen() {
  console.log("\n=== Testing Reel Comment Gen (Azure GPT) ===");
  if (!env.AZURE_OPENAI_ENDPOINT || !env.AZURE_OPENAI_API_KEY) {
    console.log("  SKIP: Azure keys not set");
    return true;
  }
  const endpoint = env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  const chatUrl = `${endpoint}/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2024-12-01-preview`;
  const resp = await fetch(chatUrl, {
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
            "You write short, funny Instagram comments on reels. Keep it to 1 sentence max.",
        },
        {
          role: "user",
          content:
            'Write a comment for this reel. The reel is by @foodie_chef. The caption is: "POV: when the recipe actually works"',
        },
      ],
      max_tokens: 60,
      temperature: 0.9,
    }),
  });
  console.log(`  Status: ${resp.status}`);
  if (resp.ok) {
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    console.log(`  Generated comment: "${text}"`);
    return !!text;
  }
  const body = await resp.text();
  console.log(`  Error: ${body.slice(0, 200)}`);
  return false;
}

// ── Runner ──
const TESTS = {
  reels: testReelsFeed,
  "explore-reels": testExploreReels,
  "media-info": testMediaInfo,
  "image-gen": testImageGen,
  confession: testConfession,
  "reel-comment": testReelCommentGen,
};

async function main() {
  const arg = process.argv[2] || "all";
  const testsToRun =
    arg === "all" ? Object.entries(TESTS) : [[arg, TESTS[arg]]];

  console.log("=== shame.ai — New TypeScript Function Tests ===");
  console.log(`  Account: ${env.ACCOUNT1_USER_ID}`);
  console.log(
    `  Azure: ${env.AZURE_OPENAI_ENDPOINT ? "configured" : "NOT SET"}`,
  );

  let passed = 0;
  let failed = 0;

  for (const [name, fn] of testsToRun) {
    if (!fn) {
      console.log(`\n  Unknown test: ${name}`);
      console.log(`  Available: ${Object.keys(TESTS).join(", ")}, all`);
      continue;
    }
    try {
      const ok = await fn();
      if (ok) {
        passed++;
        console.log(`  PASS`);
      } else {
        failed++;
        console.log(`  FAIL`);
      }
    } catch (e) {
      failed++;
      console.log(`  ERROR: ${e.message}`);
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
