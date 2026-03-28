import { NextResponse } from "next/server";
import { getIGSessionResolved } from "@/lib/session";

/** Current shame.ai IG session (for client pages like /app → Group room). */
export async function GET() {
  const ig = await getIGSessionResolved();
  if (!ig?.cookies || !ig?.userId) {
    return NextResponse.json({
      loggedIn: false,
      username: null as string | null,
      userId: null as string | null,
    });
  }
  const username = ig.username?.trim() || ig.userId;
  return NextResponse.json({
    loggedIn: true,
    username,
    userId: ig.userId,
  });
}
