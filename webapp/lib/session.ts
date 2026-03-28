import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { hydrateInstagramUsername } from "./instagram";
import type { IGSession } from "./types";

export interface SessionData {
  ig?: IGSession;
}

const sessionOptions = {
  password: process.env.IRON_SESSION_PASSWORD || "fallback_password_change_me_32ch!",
  cookieName: "shottaker_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function getIGSession(): Promise<IGSession | null> {
  const session = await getSession();
  return session.ig || null;
}

/**
 * IG session valid for API use (cookies + userId). Hydrates username when missing
 * and persists to iron-session (fixes browser login showing “logged out” on /app Group).
 */
export async function getIGSessionResolved(): Promise<IGSession | null> {
  const session = await getSession();
  const ig = session.ig;
  if (!ig?.cookies || !ig?.userId) return null;
  if (!ig.username?.trim()) {
    await hydrateInstagramUsername(ig);
    session.ig = ig;
    await session.save();
  }
  return session.ig || null;
}
