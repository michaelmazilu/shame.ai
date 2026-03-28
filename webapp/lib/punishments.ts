// Unified punishment pool — all 16 punishments for the multiplayer wheel.
// DM rituals from lib/rituals.ts + action rituals from server/routers/lottery.py.

export type PunishmentCategory =
  | "dm"
  | "comment"
  | "story"
  | "reel"
  | "profile"
  | "feed";

export interface Punishment {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: PunishmentCategory;
  weight: number;
  prompt?: string;
}

// ── 10 DM Rituals (from rituals.ts) ──

const DM_PUNISHMENTS: Punishment[] = [
  {
    id: "love_declaration",
    name: "Love Declaration",
    emoji: "\u{1F48C}",
    description: "Cringe love confession to a complete stranger",
    category: "dm",
    weight: 5,
    prompt:
      "Write an extremely over-the-top, painfully earnest love confession DM to a stranger. Like someone who is deeply in love after seeing one profile photo. Be dramatic, poetic, and embarrassingly sincere. 2-3 sentences max.",
  },
  {
    id: "fan_account",
    name: "Superfan",
    emoji: "\u{1F929}",
    description: "Pretend you're their #1 fan who knows everything about them",
    category: "dm",
    weight: 5,
    prompt:
      "Write a DM as if you're someone's deranged superfan. Reference imaginary things like 'your Tuesday posts' or 'that thing you said in your story last week changed my life'. Be uncomfortably enthusiastic. 2-3 sentences max.",
  },
  {
    id: "wrong_number",
    name: "Wrong Number",
    emoji: "\u{1F4F1}",
    description: "Send something clearly meant for someone else",
    category: "dm",
    weight: 5,
    prompt:
      "Write a DM that's obviously meant for a different person. Something deeply personal or bizarre that would be mortifying if sent to the wrong person — like confirming embarrassing plans, sharing a weird secret, or referencing an inside joke that makes no sense. 2-3 sentences max.",
  },
  {
    id: "time_traveler",
    name: "Time Traveler",
    emoji: "\u{23F0}",
    description: "Claim you're from the future with an urgent warning",
    category: "dm",
    weight: 5,
    prompt:
      "Write a DM as a time traveler from the year 2087 with an urgent, cryptic, and ridiculous warning for this person. Be vague enough to be creepy but specific enough to be funny. Dead serious tone. 2-3 sentences max.",
  },
  {
    id: "job_interview",
    name: "HR Department",
    emoji: "\u{1F4BC}",
    description: "Treat the DM like a formal corporate communication",
    category: "dm",
    weight: 5,
    prompt:
      "Write a DM in the style of a formal HR email or corporate memo. Reference 'the incident', 'your quarterly review', or 'the dress code violation'. Use corporate jargon. Dead serious. 2-3 sentences max.",
  },
  {
    id: "conspiracy",
    name: "Conspiracy Drop",
    emoji: "\u{1F53A}",
    description: "Share a wild conspiracy theory as if they're the key",
    category: "dm",
    weight: 5,
    prompt:
      "Write a DM revealing a completely absurd conspiracy theory and implying this person is somehow connected to it. Be paranoid, urgent, and reference fake evidence. 'I know you know about the pigeons.' energy. 2-3 sentences max.",
  },
  {
    id: "breakup",
    name: "The Breakup",
    emoji: "\u{1F494}",
    description: "Send a dramatic breakup text to someone you don't know",
    category: "dm",
    weight: 5,
    prompt:
      "Write a dramatic breakup DM to a complete stranger as if you had a long relationship. Reference shared memories that never happened. Be emotional, hurt, and theatrical. 'I can't believe after everything we've been through.' 2-3 sentences max.",
  },
  {
    id: "life_advice",
    name: "Unsolicited Wisdom",
    emoji: "\u{1F9D8}",
    description: "Drop bizarre life advice completely unprompted",
    category: "dm",
    weight: 5,
    prompt:
      "Write a DM giving extremely specific, bizarre, and completely unsolicited life advice. As if you've been observing their life choices and can't stay silent anymore. The advice should be oddly specific and make no sense. 2-3 sentences max.",
  },
  {
    id: "roommate",
    name: "Bad Roommate",
    emoji: "\u{1F3E0}",
    description: "Passive-aggressive note from a roommate they don't have",
    category: "dm",
    weight: 5,
    prompt:
      "Write a passive-aggressive roommate note as a DM. Complain about something specific and petty like 'your dishes', 'the thermostat', or 'what you did to the bathroom'. As if you've been living together. 2-3 sentences max.",
  },
  {
    id: "prophet",
    name: "The Prophet",
    emoji: "\u{1F52E}",
    description: "Deliver a mysterious prophecy about their future",
    category: "dm",
    weight: 5,
    prompt:
      "Write a DM delivering a deeply mysterious and oddly specific prophecy about this person's near future. Mix mundane details with dramatic cosmic language. 'The stars have shown me your Tuesday. You are not ready.' 2-3 sentences max.",
  },
];

// ── 6 Action Rituals (ported from Python server/routers/lottery.py) ──

const ACTION_PUNISHMENTS: Punishment[] = [
  {
    id: "love_confession",
    name: "Love Confession DM",
    emoji: "\u{2764}\u{FE0F}",
    description: "AI-generated love confession DM to a mutual",
    category: "dm",
    weight: 12,
  },
  {
    id: "reel_comment",
    name: "Comment on Random Reel",
    emoji: "\u{1F4AC}",
    description: "Find a trending reel and drop an embarrassing comment",
    category: "comment",
    weight: 10,
  },
  {
    id: "send_reel",
    name: "Send Random Reel via DM",
    emoji: "\u{1F3AC}",
    description: "Send a random reel to the victim via DM",
    category: "reel",
    weight: 10,
  },
  {
    id: "story_upload",
    name: "AI Image to Story",
    emoji: "\u{1F3A8}",
    description: "Generate an AI image about the victim and post to your story",
    category: "story",
    weight: 8,
  },
  {
    id: "reel_to_story",
    name: "Repost Reel to Story",
    emoji: "\u{1F4F2}",
    description: "Grab a random reel and repost it to your story",
    category: "story",
    weight: 5,
  },
  {
    id: "ai_video_story",
    name: "AI Video to Story",
    emoji: "\u{1F3AC}",
    description: "Generate an AI video about the victim and post to your story",
    category: "story",
    weight: 5,
  },
];

// ── 6 New Punishments ──

const NEW_PUNISHMENTS: Punishment[] = [
  {
    id: "embarrassing_bio",
    name: "Embarrassing Bio",
    emoji: "\u{1F4DD}",
    description:
      "AI generates a cringe bio and sets it as YOUR actual Instagram bio",
    category: "profile",
    weight: 8,
    prompt:
      "Write an embarrassing Instagram bio as a dare/punishment. Keep it to 1-2 lines. Be funny and cringe but not offensive. Think: over-the-top self-deprecation, weird flex, absurd confession. No slurs, no hashtags.",
  },
  {
    id: "pfp_swap",
    name: "AI Profile Pic Swap",
    emoji: "\u{1F921}",
    description:
      "AI generates an embarrassing image and sets it as YOUR profile picture",
    category: "profile",
    weight: 8,
    prompt:
      "Generate an embarrassing profile picture. Something funny and absurd — NOT a real person's face. Think: a potato with googly eyes, a badly drawn MS Paint portrait, a cat in a business suit, a cursed image. Keep the prompt under 20 words.",
  },
  {
    id: "cringe_comment",
    name: "Cringe Comment",
    emoji: "\u{1F631}",
    description:
      "Find the victim's latest post and leave an obsessed-fan comment",
    category: "comment",
    weight: 8,
    prompt:
      "Write an embarrassing Instagram comment as a dare. Sound like an overly obsessed fan or embarrassing friend. Keep it to 1-2 sentences. Be funny and cringe. No slurs, no hashtags. 0-1 emojis max.",
  },
  {
    id: "mass_confession",
    name: "Mass Confession x3",
    emoji: "\u{1F4E8}",
    description: "Send AI love confessions to 3 random mutuals at once",
    category: "dm",
    weight: 8,
  },
  {
    id: "feed_meme",
    name: "Meme to Feed",
    emoji: "\u{1F5BC}\u{FE0F}",
    description:
      "AI generates a meme about the victim and posts it to YOUR actual feed",
    category: "feed",
    weight: 8,
  },
  {
    id: "thirst_story",
    name: "Thirst Trap Story",
    emoji: "\u{1F494}",
    description:
      "AI generates a dramatic 'I miss you @victim' image and posts it as your story",
    category: "story",
    weight: 8,
  },
];

// ── Combined ──

export const PUNISHMENTS: Punishment[] = [
  ...DM_PUNISHMENTS,
  ...ACTION_PUNISHMENTS,
  ...NEW_PUNISHMENTS,
];

export function weightedRandomPunishment(): Punishment {
  const totalWeight = PUNISHMENTS.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * totalWeight;
  for (const p of PUNISHMENTS) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PUNISHMENTS[PUNISHMENTS.length - 1];
}

export function getPunishmentById(id: string): Punishment | undefined {
  return PUNISHMENTS.find((p) => p.id === id);
}

export const CATEGORY_COLORS: Record<PunishmentCategory, string> = {
  dm: "#E36B8A",
  comment: "#C4A265",
  story: "#F08DA0",
  reel: "#D4BC96",
  profile: "#9B59B6",
  feed: "#E67E22",
};

export const CATEGORY_LABELS: Record<PunishmentCategory, string> = {
  dm: "DM",
  comment: "Comment",
  story: "Story",
  reel: "Reel",
  profile: "Profile",
  feed: "Feed",
};
