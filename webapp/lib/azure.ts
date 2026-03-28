const TONE_PROMPTS: Record<string, string> = {
  casual: "Tone: chill and low-key. Like you're texting someone you vaguely know. No pressure.",
  flirty: "Tone: subtly confident. A little playful, never desperate or cheesy.",
  witty: "Tone: dry humor or a clever observation. Not trying too hard to be funny.",
  professional: "Tone: warm but professional. Like a friendly LinkedIn message, not corporate.",
};

export async function generateMessage(tone: string): Promise<string> {
  const endpoint = process.env.AZURE_ENDPOINT;
  const apiKey = process.env.AZURE_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error("Azure API key or endpoint not configured");
  }

  const toneGuide = TONE_PROMPTS[tone] || TONE_PROMPTS.casual;

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
            "You generate very short Instagram DM openers.",
            toneGuide,
            "Hard rules:",
            "- ONE sentence only. Keep it under 15 words.",
            "- No emojis. No exclamation marks.",
            "- Never compliment their appearance or say you 'came across their profile'.",
            "- Never use pickup lines, puns, or anything that sounds rehearsed.",
            "- Don't be pushy, overly personal, or weirdly intimate with a stranger.",
            "- Sound like a real person, not a bot. Be brief and natural.",
            "- Output ONLY the message. No quotes, no labels, nothing else.",
          ].join("\n"),
        },
        { role: "user", content: "Write one short DM opener." },
      ],
      max_tokens: 60,
      temperature: 0.9,
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
