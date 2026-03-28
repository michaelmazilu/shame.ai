import type { NextConfig } from "next";
import { mergeParentEnvLocalIntoProcess } from "./lib/merge-parent-env-local";

/** Best-effort before Next loads `webapp/.env.local`; `instrumentation.ts` merges again after. */
mergeParentEnvLocalIntoProcess();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
