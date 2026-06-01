import type { NextConfig } from "next";
import { mergeParentEnvLocalIntoProcess } from "./lib/merge-parent-env-local";

/** Best-effort before Next loads `webapp/.env.local`; `instrumentation.ts` merges again after. */
mergeParentEnvLocalIntoProcess();

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this dir. Otherwise Next walks up, finds a stray
  // lockfile at ~/package-lock.json, picks ~ as the workspace root, and fails to
  // resolve `tailwindcss` (and other deps) from webapp/node_modules.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
