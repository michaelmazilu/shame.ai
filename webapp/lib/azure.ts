interface TargetProfile {
  username: string;
  fullName?: string;
  bio?: string;
  categoryName?: string | null;
  recentCaptions?: string[];
}

function buildUserPrompt(target: TargetProfile, ritualPrompt: string): string {
  const lines: string[] = [];
  if (target.fullName) lines.push(`Name: ${target.fullName}`);
  if (target.bio) lines.push(`Bio: ${target.bio}`);
  if (target.categoryName) lines.push(`Category: ${target.categoryName}`);
  if (target.recentCaptions?.length) {
    lines.push(
      `Recent post captions:\n- ${target.recentCaptions.join("\n- ")}`,
    );
  }
  const context =
    lines.length > 0 ? `Profile context:\n${lines.join("\n")}\n\n` : "";
  return `${context}${ritualPrompt}`;
}

export async function generateRitualMessage(
  ritualPrompt: string,
  target: TargetProfile,
): Promise<string> {
  const endpoint =
    process.env.AZURE_OPENAI_ENDPOINT || process.env.AZURE_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("Azure API key or endpoint not configured");
  }

  const base = endpoint.replace(/\/$/, "");
  const url = base.includes("/openai/deployments/")
    ? base
    : `${base}/openai/deployments/gpt-4.1-mini/chat/completions?api-version=2024-12-01-preview`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: [
            "You write embarrassing Instagram DMs for a dare/party game.",
            "The messages should be funny, absurd, and harmless — never mean, hateful, sexual, or threatening.",
            "Hard rules:",
            "- Keep it under 3 sentences.",
            "- NEVER include the person's @username or full name in the message. You're DMing them directly — they already know who they are.",
            "- Use any profile context provided (bio, posts, interests) to make the message feel personal and specific.",
            "- No slurs, hate speech, sexual content, or threats.",
            "- Be creative and hilarious. The goal is secondhand embarrassment, not harm.",
            "- Output ONLY the message. No quotes, no labels, no explanation.",
          ].join("\n"),
        },
        {
          role: "user",
          content: buildUserPrompt(target, ritualPrompt),
        },
      ],
      max_tokens: 150,
      temperature: 1.0,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Azure API ${resp.status}: ${body}`);
  }

  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from Azure API");
  return text;
}
