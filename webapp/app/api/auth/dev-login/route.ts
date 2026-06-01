import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getProfileInfo, hydrateInstagramUsername } from "@/lib/instagram";
import { getSession } from "@/lib/session";
import type { IGSession } from "@/lib/types";

/**
 * LOCAL DEV ONLY — seed the iron-session with a real, authenticated Instagram
 * session so the webapp can be tested end-to-end.
 *
 * Why this exists: the username/password login flow (`loginToInstagram`) posts a
 * plaintext password and is routinely blocked by Instagram with a checkpoint, so
 * the webapp can't reliably get a session locally. Meanwhile the Python tests
 * authenticate via instagrapi and persist `test/session.json`. This route bridges
 * that working session into the webapp.
 *
 * Sources (in priority order; override with ?source=):
 *   1. instagrapi `test/session.json`  — freshest; re-run the Python login to refresh
 *   2. repo-root `.env` ACCOUNT{N}_*   — hand-copied DevTools cookies (?account=N)
 *
 * Visit:  http://localhost:3000/api/auth/dev-login
 *         http://localhost:3000/api/auth/dev-login?source=env&account=1
 */

const BASE = "https://www.instagram.com";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36";

function repoFile(...parts: string[]): string {
  // The webapp dev server runs from `webapp/`, so repo root is one level up.
  return path.resolve(process.cwd(), "..", ...parts);
}

function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(file)) return out;
  for (let line of readFileSync(file, "utf8").split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
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

/** Build a session from instagrapi's persisted session.json (mobile sessionid). */
async function fromInstagrapi(): Promise<IGSession | { error: string }> {
  const file = repoFile("test", "session.json");
  if (!existsSync(file)) {
    return {
      error:
        "test/session.json not found — run the Python instagrapi login first",
    };
  }
  let json: {
    authorization_data?: { sessionid?: string; ds_user_id?: string };
    mid?: string;
  };
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { error: "test/session.json is not valid JSON" };
  }
  const sessionid = json.authorization_data?.sessionid;
  const userId = json.authorization_data?.ds_user_id;
  const mid = json.mid || "";
  if (!sessionid || !userId) {
    return { error: "test/session.json has no authorization_data.sessionid" };
  }

  // The mobile login doesn't set a web csrftoken — mint one by hitting the
  // homepage with the sessionid, then pair them for web API calls.
  const cookieParts = [`sessionid=${sessionid}`, `ds_user_id=${userId}`];
  if (mid) cookieParts.push(`mid=${mid}`);
  let csrfToken = "";
  try {
    const home = await fetch(`${BASE}/`, {
      headers: { "user-agent": USER_AGENT, cookie: cookieParts.join("; ") },
    });
    for (const c of home.headers.getSetCookie?.() || []) {
      const m = c.match(/csrftoken=([^;]+)/);
      if (m) csrfToken = m[1];
    }
  } catch {
    /* fall through — csrf may be empty */
  }
  if (csrfToken) cookieParts.push(`csrftoken=${csrfToken}`);

  return {
    cookies: cookieParts.join("; "),
    csrfToken,
    userId,
    username: "",
  };
}

/** Build a session from repo-root .env ACCOUNT{N}_* (hand-copied DevTools cookies). */
function fromEnv(account: string): IGSession | { error: string } {
  const env = {
    ...parseEnvFile(repoFile(".env")),
    ...parseEnvFile(path.resolve(process.cwd(), ".env")),
  };
  const cookies = env[`ACCOUNT${account}_COOKIES`];
  const csrfToken = env[`ACCOUNT${account}_CSRFTOKEN`];
  const userId = env[`ACCOUNT${account}_USER_ID`];
  if (!cookies || !csrfToken || !userId) {
    return {
      error: `Missing ACCOUNT${account}_COOKIES / _CSRFTOKEN / _USER_ID in root .env`,
    };
  }
  return {
    cookies,
    csrfToken,
    userId,
    username: "",
    fbDtsg: env.FB_DTSG || undefined,
    lsd: env.LSD || undefined,
  };
}

export async function GET(req: NextRequest) {
  // Hard guard: never expose cookie-seeding in production.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return NextResponse.json(
      { error: "dev-login is only available in local development" },
      { status: 403 },
    );
  }

  const source = req.nextUrl.searchParams.get("source") || "instagrapi";
  const account = req.nextUrl.searchParams.get("account") || "1";

  const built = source === "env" ? fromEnv(account) : await fromInstagrapi();
  if ("error" in built) {
    return NextResponse.json({ error: built.error, source }, { status: 400 });
  }
  const igSession = built;

  // Validate the session actually authenticates (also fills username).
  await hydrateInstagramUsername(igSession);
  if (!igSession.username) {
    return NextResponse.json(
      {
        error:
          "Session loaded but Instagram did not return a username — credentials are expired. " +
          (source === "env"
            ? "Refresh ACCOUNT cookies in .env from DevTools."
            : "Re-run the Python instagrapi login (rm test/session.json && python test/simulate.py)."),
        source,
      },
      { status: 401 },
    );
  }

  const self = await getProfileInfo(igSession, igSession.username).catch(
    () => null,
  );

  const session = await getSession();
  session.ig = igSession;
  await session.save();

  return NextResponse.json({
    success: true,
    source,
    userId: igSession.userId,
    username: igSession.username,
    hasGraphqlTokens: !!(igSession.fbDtsg && igSession.lsd),
    selfFollowers: self?.followers ?? null,
    note: "Session seeded. The webapp now uses the same authenticated account as the Python tests.",
  });
}
