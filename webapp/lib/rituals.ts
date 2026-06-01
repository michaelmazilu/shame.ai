/**
 * What the ritual actually does on Instagram:
 * - "dm"    → send the generated text as a DM to the target (default)
 * - "bio"   → replace YOUR profile bio with the generated line
 * - "story" → post an AI-generated confession card to YOUR story
 * - "pfp"   → swap YOUR profile picture for an AI-generated cursed image
 */
export type RitualKind = "dm" | "bio" | "story" | "pfp";

export interface Ritual {
  id: string;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
  /** Defaults to "dm" when omitted. */
  kind?: RitualKind;
  /**
   * For "story"/"pfp": the image-generation prompt. `{message}` is replaced with
   * the generated text and `{target}` with the target's @username.
   */
  imagePrompt?: string;
}

/** Verb shown on the send button + status copy, per ritual kind. */
export function ritualKind(r: Ritual): RitualKind {
  return r.kind ?? "dm";
}

export const RITUALS: Ritual[] = [
  {
    id: "love_declaration",
    name: "Love Declaration",
    emoji: "💌",
    description: "Cringe love confession to a complete stranger",
    prompt:
      "Write an extremely over-the-top, painfully earnest love confession DM to a stranger. Like someone who is deeply in love after seeing one profile photo. Be dramatic, poetic, and embarrassingly sincere. 2-3 sentences max.",
  },
  {
    id: "wrong_number",
    name: "Wrong Number",
    emoji: "📱",
    description: "Send something clearly meant for someone else",
    prompt:
      "Write a DM that's obviously meant for a different person. Something deeply personal or bizarre that would be mortifying if sent to the wrong person — like confirming embarrassing plans, sharing a weird secret, or referencing an inside joke that makes no sense. 2-3 sentences max.",
  },
  {
    id: "prophet",
    name: "The Prophet",
    emoji: "🔮",
    description: "Deliver a mysterious prophecy about their future",
    prompt:
      "Write a DM delivering a deeply mysterious and oddly specific prophecy about this person's near future. Mix mundane details with dramatic cosmic language. 'The stars have shown me your Tuesday. You are not ready.' 2-3 sentences max.",
  },

  // ── Self-account deeds (act on YOUR account, about the target) ──
  {
    id: "bio_takeover",
    name: "Bio Takeover",
    emoji: "🪧",
    description: "Your bio becomes a public confession about the target",
    kind: "bio",
    prompt:
      "Write a SINGLE Instagram bio line (max 80 characters) that publicly and cringingly declares undying obsession with the target. First person, unhinged but harmless and funny. Include their @username. Output ONLY the bio line, no quotes.",
  },
  {
    id: "story_confession",
    name: "Story Confession",
    emoji: "📖",
    description:
      "Post an AI confession card to your story for all your followers",
    kind: "story",
    prompt:
      "Write ONE short, dramatic public confession (max 12 words) about the target, suitable for a big bold story card. Earnest and embarrassing but harmless. Output ONLY the confession text, no quotes.",
    imagePrompt:
      'A vertical Instagram story graphic, soft pink and cream gradient background with little hearts, big bold centered handwritten text reading: "{message}". Cute, dramatic, romantic-comedy aesthetic.',
  },
  {
    id: "pfp_swap",
    name: "Profile Pic Swap",
    emoji: "🖼️",
    description: "Swap your profile pic for an AI-cursed shrine to the target",
    kind: "pfp",
    prompt:
      "Describe, in under 12 words, the absurd 'shrine to my crush' profile picture you are about to set. Harmless and funny. Output ONLY the description.",
    imagePrompt:
      'A funny, wholesome cartoon avatar of a person who is hopelessly in love with their crush {target} — surrounded by floating hearts, holding a tiny sign that says "#1 fan". Bright, cute, romantic-comedy sticker style, square.',
  },
];

export function getRandomRitual(): Ritual {
  return RITUALS[Math.floor(Math.random() * RITUALS.length)];
}
