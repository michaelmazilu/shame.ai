import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
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
