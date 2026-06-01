// AI generation services — Azure FLUX (images), Sora-2 (video), GPT-4.1-mini (text)
// Ported from server/services/image_gen.py, video_gen.py, ai.py

// ── Image Generation (Azure FLUX.1-Kontext-pro) ──

export async function generateImage(
  prompt: string,
  size = "1024x1024",
): Promise<{
  success: boolean;
  imageUrl?: string;
  imageB64?: string;
  revisedPrompt?: string;
  error?: string;
}> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!endpoint || !apiKey) {
    return { success: false, error: "Azure endpoint/key not configured" };
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/FLUX.1-Kontext-pro/images/generations?api-version=2025-04-01-preview`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size, n: 1 }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    return {
      success: false,
      error: `FLUX API ${resp.status}: ${body.slice(0, 500)}`,
    };
  }

  const data = await resp.json();
  const img = data.data?.[0];
  if (!img) return { success: false, error: "No images in response" };

  return {
    success: true,
    imageUrl: img.url || undefined,
    imageB64: img.b64_json || undefined,
    revisedPrompt: img.revised_prompt || undefined,
  };
}

/**
 * Generate an image and return it as raw bytes, regardless of whether FLUX
 * replies with base64 or a URL. Used by the story/pfp deed routes so the heavy
 * image data never has to round-trip through the browser.
 */
export async function generateImageBuffer(
  prompt: string,
  size = "1024x1024",
): Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }> {
  const img = await generateImage(prompt, size);
  if (!img.success) return { success: false, error: img.error };

  if (img.imageB64) {
    const bytes = Uint8Array.from(atob(img.imageB64), (c) => c.charCodeAt(0));
    return { success: true, buffer: bytes.buffer };
  }
  if (img.imageUrl) {
    try {
      const resp = await fetch(img.imageUrl);
      if (!resp.ok) {
        return { success: false, error: `Image fetch ${resp.status}` };
      }
      return { success: true, buffer: await resp.arrayBuffer() };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
  return { success: false, error: "No image data returned" };
}

// ── Video Generation (Azure Sora-2) ──

export async function submitVideoJob(
  prompt: string,
  duration = 5,
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!endpoint || !apiKey) {
    return { success: false, error: "Azure endpoint/key not configured" };
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/sora/videos/generations?api-version=2025-04-01-preview`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, n: 1, size: "1080x1920", duration }),
  });

  if (resp.status === 202 || resp.ok) {
    const data = resp.headers.get("content-type")?.includes("json")
      ? await resp.json()
      : {};
    const jobId =
      data.id ||
      resp.headers.get("operation-location")?.split("/").pop()?.split("?")[0];
    return { success: true, jobId: jobId || undefined };
  }

  const body = await resp.text();
  return {
    success: false,
    error: `Sora API ${resp.status}: ${body.slice(0, 500)}`,
  };
}

export async function checkVideoStatus(
  jobId: string,
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  if (!endpoint || !apiKey) {
    return { status: "error", error: "Azure endpoint/key not configured" };
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/sora/videos/generations/${jobId}?api-version=2025-04-01-preview`;

  const resp = await fetch(url, {
    headers: { "api-key": apiKey },
  });

  if (!resp.ok) {
    const body = await resp.text();
    return { status: "error", error: body.slice(0, 500) };
  }

  const data = await resp.json();
  const status = data.status || "unknown";

  if (status === "succeeded") {
    const generations = data.data || data.generations || [];
    const videoUrl = generations[0]?.url || generations[0]?.video?.url;
    return { status, videoUrl };
  }

  if (status === "failed") {
    return { status, error: data.error?.message || "Video generation failed" };
  }

  return { status };
}

// ── Text Generation (Azure GPT-4.1-mini) ──

async function azureChat(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 100,
  temperature = 0.9,
): Promise<string> {
  const endpoint = process.env.AZURE_ENDPOINT;
  const apiKey = process.env.AZURE_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error("Azure chat endpoint/key not configured");
  }

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Azure chat ${resp.status}: ${body}`);
  }

  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from Azure chat");
  return text;
}

export async function generateConfession(
  username: string,
  fullName?: string,
  bio?: string,
): Promise<string> {
  const name = fullName || username;
  let context = `Their name is ${name} (Instagram: @${username}).`;
  if (bio) context += ` Their bio says: "${bio}"`;

  return azureChat(
    "You write short, flirty Instagram DMs. Keep it under 2 sentences. " +
      "Be casual, confident, a little cheesy but not cringe. " +
      "Don't use emojis excessively. No hashtags. " +
      "This is a love confession / shooting your shot message. " +
      "If you know something about them from their bio, reference it naturally.",
    `Write a love confession DM. ${context}`,
  );
}

export async function generateReelComment(
  caption?: string,
  username?: string,
): Promise<string> {
  const parts: string[] = [];
  if (username) parts.push(`The reel is by @${username}.`);
  if (caption) parts.push(`The caption is: "${caption.slice(0, 200)}"`);
  const context = parts.length ? parts.join(" ") : "A random Instagram reel.";

  return azureChat(
    "You write short, funny Instagram comments on reels. " +
      "Keep it to 1 sentence max. Be witty, relatable, or hype. " +
      "Sound like a real person, not a bot. No hashtags. " +
      "Don't use emojis excessively (0-1 max).",
    `Write a comment for this reel. ${context}`,
    60,
  );
}

export async function generateCringeComment(
  username?: string,
  caption?: string,
): Promise<string> {
  let context = "";
  if (username) context += `The post is by @${username}. `;
  if (caption) context += `Caption: "${caption.slice(0, 150)}". `;

  return azureChat(
    "You write embarrassing Instagram comments as a dare. " +
      "The comment should look like an overly obsessed fan or an embarrassing friend. " +
      "Keep it to 1-2 sentences. Be funny and cringe. " +
      "No slurs or bullying, just comedy. No hashtags. 0-1 emojis max.",
    `Write an embarrassing comment. ${context}`,
    60,
    1.0,
  );
}
