import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Fills `process.env` from repo root `.env.local` when a key is missing or
 * empty. Next injects `webapp/.env.local` *after* `next.config` is evaluated,
 * which can overwrite parent values with `KEY=` — call again from
 * `instrumentation.ts` (runs after Next’s dotenv) so repo-root secrets win.
 */
export function mergeParentEnvLocalIntoProcess(): void {
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
    if (!process.env[key]?.trim()) {
      process.env[key] = val;
    }
  }
}
