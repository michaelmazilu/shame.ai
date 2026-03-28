#!/usr/bin/env node
/* Creates webapp/.env.local from .env.example once; warns if root .env.local key empty on disk. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const target = path.join(root, "webapp", ".env.local");
const example = path.join(root, "webapp", ".env.example");
const rootEnv = path.join(root, ".env.local");

if (!fs.existsSync(target) && fs.existsSync(example)) {
  fs.copyFileSync(example, target);
  console.log(
    "\n[shame.ai] Created webapp/.env.local — add your Supabase URL + key, save, then npm run dev again.\n",
  );
}

function warnIfRootSupabaseIncomplete() {
  if (!fs.existsSync(rootEnv)) return;
  let raw = fs.readFileSync(rootEnv, "utf8");
  raw = raw.replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  let urlVal = "";
  let keyVal = "";
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (k === "SUPABASE_URL") urlVal = v;
    if (k === "SUPABASE_PUBLISHABLE_KEY") keyVal = v;
  }
  if (urlVal && !keyVal) {
    console.error(
      "\n\x1b[31m[shame.ai]\x1b[0m " +
        rootEnv +
        " has SUPABASE_URL but SUPABASE_PUBLISHABLE_KEY is empty \x1b[33mon disk\x1b[0m.\n" +
        "  Your editor may show a key that is \x1b[33mnot saved\x1b[0m — press Save, then restart npm run dev.\n",
    );
  }
}

warnIfRootSupabaseIncomplete();
