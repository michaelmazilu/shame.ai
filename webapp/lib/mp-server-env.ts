import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { mergeParentEnvLocalIntoProcess } from "./merge-parent-env-local";

let reconciledProcessEnvForMp = false;

function ensureParentEnvForMp(): void {
  if (reconciledProcessEnvForMp) return;
  reconciledProcessEnvForMp = true;
  mergeParentEnvLocalIntoProcess();
}

/**
 * Env for `/api/mp/*` proxy. Merges `process.env` with on-disk `.env.local`
 * (webapp + repo root). Next can inject empty `SUPABASE_*=` from webapp while
 * real values live only in repo root — disk pass picks those up.
 */
function firstNonEmpty(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    const t = v?.trim();
    if (t) return t;
  }
  return "";
}

function isPlaceholderSupabaseUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    !u.startsWith("http") ||
    u.includes("your_project") ||
    u.includes("placeholder") ||
    u.includes("example.com")
  );
}

function isPlaceholderSupabaseKey(key: string): boolean {
  const k = key.trim();
  if (k.length < 20) return true;
  if (/your[_\s-]*key/i.test(k)) return true;
  if (k.includes("...")) return true;
  return false;
}

/** Treat env value as unset if empty or example placeholder. */
function envUrl(v: string | undefined): string {
  const t = firstNonEmpty(v);
  if (!t || isPlaceholderSupabaseUrl(t)) return "";
  return t.replace(/\/$/, "");
}

function envKey(v: string | undefined): string {
  const t = firstNonEmpty(v);
  if (!t || isPlaceholderSupabaseKey(t)) return "";
  return t;
}

function firstValidUrl(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const u = envUrl(c);
    if (u) return u;
  }
  return "";
}

function firstValidKey(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const k = envKey(c);
    if (k) return k;
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

function readEnvLocalAt(filePath: string): Record<string, string> {
  try {
    if (!existsSync(filePath)) return {};
    return parseDotEnvFile(readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function readWebappEnvLocal(): Record<string, string> {
  return readEnvLocalAt(path.resolve(process.cwd(), ".env.local"));
}

function readParentEnvLocal(): Record<string, string> {
  return readEnvLocalAt(path.resolve(process.cwd(), "..", ".env.local"));
}

export function getMpServerEnv(): { url: string; key: string } {
  ensureParentEnvForMp();
  const web = readWebappEnvLocal();
  const parent = readParentEnvLocal();

  const url = firstValidUrl(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    web.SUPABASE_URL,
    web.NEXT_PUBLIC_SUPABASE_URL,
    parent.SUPABASE_URL,
    parent.NEXT_PUBLIC_SUPABASE_URL,
  );

  const key = firstValidKey(
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    web.SUPABASE_PUBLISHABLE_KEY,
    web.SUPABASE_ANON_KEY,
    web.KEY,
    web.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    web.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    parent.SUPABASE_PUBLISHABLE_KEY,
    parent.SUPABASE_ANON_KEY,
    parent.KEY,
    parent.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    parent.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return { url, key };
}
