#!/usr/bin/env node
/**
 * Reads webapp/.env.local + repo root ../.env.local and pushes secrets to Vercel
 * for production, preview (all branches), and development.
 * Run from webapp/: node scripts/sync-vercel-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webappRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webappRoot, "..");

function parseDotEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (let line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const web = parseDotEnv(path.join(webappRoot, ".env.local"));
const root = parseDotEnv(path.join(repoRoot, ".env.local"));
const merged = { ...root, ...web };

const azureFull = merged.AZURE_ENDPOINT || "";
const openaiBase = azureFull.replace(/\/openai\/.*$/, "").trim() || merged.AZURE_OPENAI_ENDPOINT || "";

const toSet = {
  IRON_SESSION_PASSWORD: merged.IRON_SESSION_PASSWORD,
  AZURE_ENDPOINT: merged.AZURE_ENDPOINT,
  AZURE_API_KEY: merged.AZURE_API_KEY,
  SUPABASE_URL: (merged.SUPABASE_URL || "").replace(/\/$/, ""),
  SUPABASE_PUBLISHABLE_KEY: merged.SUPABASE_PUBLISHABLE_KEY,
  AZURE_OPENAI_ENDPOINT: openaiBase,
  AZURE_OPENAI_API_KEY: merged.AZURE_OPENAI_API_KEY || merged.AZURE_API_KEY,
};

function pushVar(name, value, target) {
  const args = ["vercel", "env", "add", name, target, "--value", value, "--yes", "--force"];
  execFileSync("npx", args, {
    cwd: webappRoot,
    stdio: "inherit",
  });
}

for (const [name, value] of Object.entries(toSet)) {
  if (!value) {
    console.warn(`[skip] ${name}: no value in .env.local files`);
    continue;
  }
  for (const target of ["production", "preview", "development"]) {
    try {
      pushVar(name, value, target);
      console.log(`ok ${name} (${target})`);
    } catch {
      console.error(`fail ${name} (${target})`);
      process.exitCode = 1;
    }
  }
}
