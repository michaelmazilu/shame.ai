import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Find repo root as the directory that contains `webapp/package.json`, walking
 * up from `process.cwd()`. Fixes Supabase env reads when cwd is nested
 * (e.g. Turbopack/temp dirs) or not exactly `webapp/` vs repo root.
 */
export function resolveRepoAndWebappDirs(): {
  repoRoot: string;
  webappDir: string;
} {
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 14; i++) {
    if (existsSync(path.join(dir, "webapp", "package.json"))) {
      return { repoRoot: dir, webappDir: path.join(dir, "webapp") };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const cwd = process.cwd();
  const base = path.basename(cwd);
  if (base.toLowerCase() === "webapp") {
    return { repoRoot: path.resolve(cwd, ".."), webappDir: cwd };
  }
  return { repoRoot: cwd, webappDir: path.join(cwd, "webapp") };
}
