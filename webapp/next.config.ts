import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Repo root `.env.local` when `next dev` / `next build` runs from `webapp/`. */
function loadOptionalParentEnvLocal() {
  const file = path.resolve(process.cwd(), "..", ".env.local");
  if (!existsSync(file)) return;
  const raw = readFileSync(file, "utf8");
  for (let line of raw.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Fill when missing OR empty (webapp/.env.local often has SUPABASE_URL= placeholders)
    if (!process.env[key]?.trim()) {
      process.env[key] = val;
    }
  }
}

loadOptionalParentEnvLocal();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
