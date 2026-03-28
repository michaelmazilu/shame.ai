import { NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";

export async function GET() {
  const ig = await getIGSession();
  if (ig) {
    return NextResponse.json({ loggedIn: true, username: ig.username, userId: ig.userId });
  }
  return NextResponse.json({ loggedIn: false });
}
