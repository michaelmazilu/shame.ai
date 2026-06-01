import type { Ritual } from "./rituals";
import { ritualKind } from "./rituals";

/**
 * Local, no-AI message generator. Each ritual has a few canned variants with
 * `{t}` standing in for the target's @username. We use this instead of the
 * Azure text endpoint so the wheel works instantly and offline.
 */
const TEMPLATES: Record<string, string[]> = {
  love_declaration: [
    "@{t} I know we've never spoken but I would genuinely take a bullet for you 😭💍",
    "@{t} one look at your profile and I knew. You're the one. Please don't block me 💗",
  ],
  wrong_number: [
    "hey it's me — don't tell anyone but the thing is happening tonight 👀 bring the ladder",
    "ok i hid it where we agreed. act normal at dinner. delete this 🤫",
  ],
  prophet: [
    "@{t} the stars have shown me your Tuesday. You are not ready. Beware the blue umbrella 🔮",
    "@{t} a great reckoning approaches. it involves a parking ticket and a man named Greg. prepare 🌙",
  ],
  bio_takeover: [
    "📍 hopelessly in love with @{t} 💍 #1 fan",
    "in a situationship with @{t} (they don't know yet) 🫶",
  ],
  story_confession: [
    "I'm in love with @{t} 💌",
    "@{t} please just notice me 😭",
  ],
  pfp_swap: [
    "my new identity: @{t}'s #1 fan 🖼️",
    "shrine to @{t} — now activated",
  ],
};

const FALLBACK: Record<string, string[]> = {
  dm: ["@{t} hi. you don't know me yet. but you will 👀"],
  bio: ["📍 #1 fan of @{t} 💗"],
  story: ["I 💌 @{t}"],
  pfp: ["shrine to @{t}"],
};

export function localRitualMessage(
  ritual: Ritual,
  targetUsername: string,
): string {
  const variants = TEMPLATES[ritual.id] ||
    FALLBACK[ritualKind(ritual)] || ["@{t}"];
  const pick = variants[Math.floor(Math.random() * variants.length)];
  return pick.replace(/\{t\}/g, targetUsername);
}
