export interface Ritual {
  id: string;
  name: string;
  emoji: string;
  description: string;
  prompt: string;
}

export const RITUALS: Ritual[] = [
  {
    id: "love_declaration",
    name: "Love Declaration",
    emoji: "💌",
    description: "Cringe love confession to a complete stranger",
    prompt: "Write an extremely over-the-top, painfully earnest love confession DM to a stranger. Like someone who is deeply in love after seeing one profile photo. Be dramatic, poetic, and embarrassingly sincere. 2-3 sentences max.",
  },
  {
    id: "fan_account",
    name: "Superfan",
    emoji: "🤩",
    description: "Pretend you're their #1 fan who knows everything about them",
    prompt: "Write a DM as if you're someone's deranged superfan. Reference imaginary things like 'your Tuesday posts' or 'that thing you said in your story last week changed my life'. Be uncomfortably enthusiastic. 2-3 sentences max.",
  },
  {
    id: "wrong_number",
    name: "Wrong Number",
    emoji: "📱",
    description: "Send something clearly meant for someone else",
    prompt: "Write a DM that's obviously meant for a different person. Something deeply personal or bizarre that would be mortifying if sent to the wrong person — like confirming embarrassing plans, sharing a weird secret, or referencing an inside joke that makes no sense. 2-3 sentences max.",
  },
  {
    id: "time_traveler",
    name: "Time Traveler",
    emoji: "⏰",
    description: "Claim you're from the future with an urgent warning",
    prompt: "Write a DM as a time traveler from the year 2087 with an urgent, cryptic, and ridiculous warning for this person. Be vague enough to be creepy but specific enough to be funny. Dead serious tone. 2-3 sentences max.",
  },
  {
    id: "job_interview",
    name: "HR Department",
    emoji: "💼",
    description: "Treat the DM like a formal corporate communication",
    prompt: "Write a DM in the style of a formal HR email or corporate memo. Reference 'the incident', 'your quarterly review', or 'the dress code violation'. Use corporate jargon. Dead serious. 2-3 sentences max.",
  },
  {
    id: "conspiracy",
    name: "Conspiracy Drop",
    emoji: "🔺",
    description: "Share a wild conspiracy theory as if they're the key",
    prompt: "Write a DM revealing a completely absurd conspiracy theory and implying this person is somehow connected to it. Be paranoid, urgent, and reference fake evidence. 'I know you know about the pigeons.' energy. 2-3 sentences max.",
  },
  {
    id: "breakup",
    name: "The Breakup",
    emoji: "💔",
    description: "Send a dramatic breakup text to someone you don't know",
    prompt: "Write a dramatic breakup DM to a complete stranger as if you had a long relationship. Reference shared memories that never happened. Be emotional, hurt, and theatrical. 'I can't believe after everything we've been through.' 2-3 sentences max.",
  },
  {
    id: "life_advice",
    name: "Unsolicited Wisdom",
    emoji: "🧘",
    description: "Drop bizarre life advice completely unprompted",
    prompt: "Write a DM giving extremely specific, bizarre, and completely unsolicited life advice. As if you've been observing their life choices and can't stay silent anymore. The advice should be oddly specific and make no sense. 2-3 sentences max.",
  },
  {
    id: "roommate",
    name: "Bad Roommate",
    emoji: "🏠",
    description: "Passive-aggressive note from a roommate they don't have",
    prompt: "Write a passive-aggressive roommate note as a DM. Complain about something specific and petty like 'your dishes', 'the thermostat', or 'what you did to the bathroom'. As if you've been living together. 2-3 sentences max.",
  },
  {
    id: "prophet",
    name: "The Prophet",
    emoji: "🔮",
    description: "Deliver a mysterious prophecy about their future",
    prompt: "Write a DM delivering a deeply mysterious and oddly specific prophecy about this person's near future. Mix mundane details with dramatic cosmic language. 'The stars have shown me your Tuesday. You are not ready.' 2-3 sentences max.",
  },
];

export function getRandomRitual(): Ritual {
  return RITUALS[Math.floor(Math.random() * RITUALS.length)];
}
