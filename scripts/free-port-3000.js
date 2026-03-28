#!/usr/bin/env node
/**
 * Stops whatever is listening on port 3000 so `next dev` can bind there.
 * Avoids: "Port 3000 is in use" → fallback 3001 → "Another next dev server is already running".
 */
const { execSync } = require("child_process");

if (process.platform === "win32") {
  try {
    const out = execSync(
      'netstat -ano | findstr :3000 | findstr LISTENING',
      { encoding: "utf8" },
    );
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch (_) {}
    }
    if (pids.size)
      console.log("[shame.ai] Freed port 3000 (Windows).");
  } catch (_) {}
  process.exit(0);
}

try {
  // macOS / Linux: listeners only when supported
  const out = execSync(
    "lsof -nP -iTCP:3000 -sTCP:LISTEN -t 2>/dev/null || lsof -ti:3000 2>/dev/null",
    {
      encoding: "utf8",
      shell: "/bin/sh",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim();
  const pids = out.split(/\n/).filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid, 10), "SIGTERM");
    } catch (_) {}
  }
  if (pids.length) {
    console.log("[shame.ai] Stopped previous listener on port 3000 (PID " + pids.join(", ") + ").");
  }
} catch (_) {
  /* nothing listening */
}
