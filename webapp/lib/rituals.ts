export type RitualAction = "dm" | "dm_confession" | "comment" | "send_reel";

export interface Ritual {
  id: string;
  name: string;
  emoji: string;
  description: string;
  action: RitualAction;
  /** Whether the user gets to edit a message before sending */
  needsMessage: boolean;
  /** Whether this ritual targets another person (DM/send) vs self-action (story/comment) */
  involvesTarget: boolean;
  /** AI prompt for DM text generation (only for action === "dm") */
  prompt: string;
}

export const RITUALS: Ritual[] = [
  // ── DM ritual (single one — AI generates, user edits) ──
  {
    id: "dm_shame",
    name: "Shame DM",
    emoji: "💌",
    description: "AI-generated cringe message sent via DM",
    action: "dm",
    needsMessage: true,
    involvesTarget: true,
    prompt:
      "Write an embarrassing, funny, and absurd DM for a dare game. It should cause secondhand embarrassment but be completely harmless. Be creative — could be a love confession, conspiracy theory, wrong number text, fake HR memo, or bizarre prophecy. 2-3 sentences max.",
  },

  // ── Action rituals (Python backend executes automatically) ──
  {
    id: "love_confession",
    name: "AI Confession",
    emoji: "😳",
    description: "AI writes and sends a love confession DM",
    action: "dm_confession",
    needsMessage: false,
    involvesTarget: true,
    prompt: "",
  },
  {
    id: "reel_comment",
    name: "Reel Roast",
    emoji: "🎬",
    description: "AI comments on a random trending reel",
    action: "comment",
    needsMessage: false,
    involvesTarget: false,
    prompt: "",
  },
  {
    id: "send_reel",
    name: "Reel Bomb",
    emoji: "💣",
    description: "Send a random reel to the victim via DM",
    action: "send_reel",
    needsMessage: false,
    involvesTarget: true,
    prompt: "",
  },
];

export function getRandomRitual(): Ritual {
  return RITUALS[Math.floor(Math.random() * RITUALS.length)];
}
