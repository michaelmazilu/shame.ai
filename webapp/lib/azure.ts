export async function generateRitualMessage(ritualPrompt: string, targetUsername: string): Promise<string> {
  const endpoint = process.env.AZURE_ENDPOINT;
  const apiKey = process.env.AZURE_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("Azure API key or endpoint not configured");
  }

  const resp = await fetch(endpoint, {
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
            "- No slurs, hate speech, sexual content, or threats.",
            "- Be creative and hilarious. The goal is secondhand embarrassment, not harm.",
            "- Output ONLY the message. No quotes, no labels, no explanation.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Target: @${targetUsername}\n\n${ritualPrompt}`,
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
