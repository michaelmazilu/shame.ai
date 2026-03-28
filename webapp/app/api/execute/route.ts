import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { pythonFetch, pythonJson } from "@/lib/python-api";
import type { RitualAction } from "@/lib/rituals";

interface ExecuteRequest {
  action: RitualAction;
  victimId: string;
  victimUsername: string;
  targetId?: string;
  targetUsername?: string;
  message?: string;
}

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body: ExecuteRequest = await req.json();
  const { action, victimId, victimUsername, targetId, message } = body;

  try {
    let result: Record<string, any>;

    switch (action) {
      case "dm": {
        const recipientId = targetId || victimId;
        const resp = await pythonFetch("/dm/send", {
          method: "POST",
          body: JSON.stringify({ recipient_id: recipientId, text: message }),
        });
        result = await pythonJson(resp);
        break;
      }

      case "dm_confession": {
        const resp = await pythonFetch("/dm/confession", {
          method: "POST",
          body: JSON.stringify({
            recipient_id: victimId,
            username: victimUsername,
          }),
        });
        result = await pythonJson(resp);
        break;
      }

      case "comment": {
        // Comment on the target's latest post
        const resp = await pythonFetch("/comment/user", {
          method: "POST",
          body: JSON.stringify({
            user_id: targetId || victimId,
            username: body.targetUsername || victimUsername,
          }),
        });
        result = await pythonJson(resp);
        break;
      }

      case "send_reel": {
        // Send a reel via DM
        const reelUrl = "https://www.instagram.com/reels/DWZV25ejulO/";
        const resp = await pythonFetch("/dm/reel", {
          method: "POST",
          body: JSON.stringify({
            recipient_id: targetId || victimId,
            reel_url: reelUrl,
          }),
        });
        result = await pythonJson(resp);
        break;
      }

      case "story_image": {
        const prompt = `A funny meme about @${victimUsername}`;
        const imgResp = await pythonFetch("/media/generate-image", {
          method: "POST",
          body: JSON.stringify({ prompt }),
        });
        const imgData = await pythonJson(imgResp);
        if (!imgData.success) {
          return NextResponse.json(
            {
              success: false,
              error: imgData.error || "Image generation failed",
            },
            { status: 500 },
          );
        }
        const filePath = imgData.images?.[0]?.path;
        const storyResp = await pythonFetch("/story/upload", {
          method: "POST",
          body: JSON.stringify({
            file_path: filePath,
            caption: `for @${victimUsername}`,
          }),
        });
        result = await pythonJson(storyResp);
        if (!result.media_id && !result.success) {
          result.success = false;
          result.error =
            result.error ||
            "Story upload failed — Instagram may be blocking cloud logins";
        }
        result.image = imgData;
        break;
      }

      case "story_reel": {
        const reelResp = await pythonFetch("/comment/random-reel", {
          method: "POST",
          body: JSON.stringify({ source: "trending", dry_run: true }),
        });
        const reelData = await pythonJson(reelResp);
        const reelUrl = reelData.reel?.url || reelData.reel?.shortcode;
        if (!reelUrl) {
          return NextResponse.json(
            { success: false, error: "No reels found" },
            { status: 500 },
          );
        }
        const resp = await pythonFetch("/story/repost-reel", {
          method: "POST",
          body: JSON.stringify({ reel_url: reelUrl }),
        });
        result = await pythonJson(resp);
        if (!result.media_id && !result.success) {
          result.success = false;
          result.error =
            result.error ||
            "Story repost failed — Instagram may be blocking cloud logins";
        }
        result.reel = reelData.reel;
        break;
      }

      case "story_video": {
        const prompt = `A funny short video about someone named ${victimUsername}`;
        const resp = await pythonFetch("/media/generate-video", {
          method: "POST",
          body: JSON.stringify({ prompt }),
        });
        result = await pythonJson(resp);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }

    // Normalize success field
    if (result.success === undefined) {
      result.success = !result.error;
    }

    return NextResponse.json({ action, ...result });
  } catch (e) {
    console.error("[Execute] Error:", e);
    return NextResponse.json(
      { success: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
