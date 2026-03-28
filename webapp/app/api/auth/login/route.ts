import { NextRequest, NextResponse } from "next/server";
import { loginToInstagram } from "@/lib/instagram";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required" }, { status: 400 });
  }

  const result = await loginToInstagram(username, password);

  if (result.twoFactorRequired) {
    return NextResponse.json({
      twoFactorRequired: true,
      twoFactorInfo: result.twoFactorInfo,
    });
  }

  if (!result.success || !result.session) {
    return NextResponse.json({ error: result.error || "Login failed" }, { status: 401 });
  }

  const session = await getSession();
  session.ig = result.session;
  await session.save();

  return NextResponse.json({
    success: true,
    userId: result.session.userId,
    username: result.session.username,
  });
}
