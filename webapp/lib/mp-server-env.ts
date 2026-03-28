import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Env for `/api/mp/*` proxy. Uses non-empty `process.env` first, then parses
 * repo root `../.env.local` if URL/key still missing (fixes empty placeholders
 * in `webapp/.env.local` shadowing root keys).
 */
function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

function parseDotEnvFile(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
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
    out[key] = val;
  }
  return out;
}

function readParentEnvLocal(): Record<string, string> {
  try {
    const file = path.resolve(process.cwd(), "..", ".env.local");
    if (!existsSync(file)) return {};
    return parseDotEnvFile(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

export function getMpServerEnv(): { url: string; key: string } {
  let url = firstNonEmpty(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ).replace(/\/$/, "");
  let key = firstNonEmpty(
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!url || !key) {
    const parent = readParentEnvLocal();
    if (!url) {
      url = firstNonEmpty(
        parent.SUPABASE_URL,
        parent.NEXT_PUBLIC_SUPABASE_URL,
      ).replace(/\/$/, "");
    }
    if (!key) {
      key = firstNonEmpty(
        parent.SUPABASE_PUBLISHABLE_KEY,
        parent.SUPABASE_ANON_KEY,
        parent.KEY,
        parent.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        parent.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );
    }
  }

  return { url, key };
}
