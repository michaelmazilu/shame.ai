/**
 * Env for `/api/mp/*` proxy only. Prefer server-only `SUPABASE_*`; also accepts
 * `NEXT_PUBLIC_*` so the same values in webapp/.env.local still work (read on
 * server only — not referenced from client components).
 */
export function getMpServerEnv(): { url: string; key: string } {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const key = (
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, key };
}
