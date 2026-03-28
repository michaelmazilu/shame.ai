"use client";

import { motion } from "motion/react";
import type { IGProfile } from "@/lib/types";
import type { Ritual } from "@/lib/rituals";

function proxyPic(url?: string) {
  if (!url) return undefined;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

function Avatar({
  user,
  size = "sm",
}: {
  user: IGProfile;
  size?: "sm" | "md";
}) {
  const pic = proxyPic(user.profilePic);
  const s = size === "md" ? "w-10 h-10" : "w-7 h-7";
  const text = size === "md" ? "text-sm" : "text-[10px]";

  if (pic) {
    return (
      <img
        src={pic}
        alt=""
        className={`${s} rounded-full object-cover ring-2 ring-blush/30 shrink-0`}
        draggable={false}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className={`${s} rounded-full bg-blush/30 flex items-center justify-center ${text} font-bold text-rose shrink-0`}
    >
      {user.username[0]?.toUpperCase()}
    </div>
  );
}

/** Context-aware action description shown in the card */
function actionDescription(
  ritual: Ritual,
  victim: IGProfile,
  target: IGProfile,
): string {
  switch (ritual.action) {
    case "dm_confession":
      return `An AI love confession will be sent to @${victim.username}`;
    case "send_reel":
      return `A random reel will be sent to @${victim.username} via DM`;
    case "comment":
      return `An AI-generated embarrassing comment will be posted on @${target.username}'s latest post`;
    case "story_image":
      return "An AI-generated meme will be posted to your Instagram story";
    case "story_reel":
      return "A random trending reel will be reposted to your Instagram story";
    case "story_video":
      return "An AI-generated video will be posted to your Instagram story";
    default:
      return ritual.description;
  }
}

interface ResultCardProps {
  victim: IGProfile;
  ritual: Ritual;
  target: IGProfile;
  message: string;
  messageLoading: boolean;
  error: string;
  solo?: boolean;
  onMessageChange: (msg: string) => void;
  onReroll: () => void;
  onSend: () => void;
}

export default function ResultCard({
  victim,
  ritual,
  target,
  message,
  messageLoading,
  error,
  solo,
  onMessageChange,
  onReroll,
  onSend,
}: ResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.4,
        type: "spring",
        stiffness: 200,
        damping: 20,
      }}
      className="w-full"
    >
      {/* Summary pills — adapt based on ritual type */}
      <div className="flex items-center justify-center gap-3 mb-3 flex-wrap">
        {ritual.involvesTarget ? (
          /* DM / send rituals: show victim → target */
          <>
            {solo ? (
              <div className="flex items-center gap-2 bg-rose/10 border border-rose/20 rounded-full px-4 py-2">
                <span className="text-base font-bold text-rose">You</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white border border-beige/40 rounded-full px-3 py-1.5">
                <Avatar user={victim} size="md" />
                <span className="text-sm font-semibold text-zinc-800">
                  @{victim.username}
                </span>
              </div>
            )}
            <span className="text-2xl">{ritual.emoji}</span>
            <div className="flex items-center gap-2 bg-white border border-beige/40 rounded-full px-3 py-1.5">
              <span className="text-sm text-zinc-400">&rarr;</span>
              <Avatar user={target} size="md" />
              <span className="text-sm font-semibold text-zinc-800">
                @{target.username}
              </span>
            </div>
          </>
        ) : (
          /* Self-action rituals: show just the ritual + "Your Account" */
          <>
            <span className="text-3xl">{ritual.emoji}</span>
            <div className="flex items-center gap-2 bg-rose/10 border border-rose/20 rounded-full px-4 py-2">
              <span className="text-sm font-bold text-rose">{ritual.name}</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-beige/40 rounded-full px-3 py-1.5">
              <span className="text-sm text-zinc-400">&rarr;</span>
              <span className="text-sm font-semibold text-zinc-800">
                Your Story
              </span>
            </div>
          </>
        )}
      </div>

      {ritual.needsMessage ? (
        /* DM rituals — editable message textarea */
        messageLoading ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              className="w-6 h-6 border-2 border-blush border-t-rose rounded-full"
            />
            <p className="text-sm text-zinc-400">Crafting the shame&hellip;</p>
          </div>
        ) : message ? (
          <div className="space-y-3">
            <div className="bg-white border border-beige/40 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-400 font-semibold">
                  {ritual.name}
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                rows={3}
                className="w-full bg-cream-light/60 border border-beige/30 rounded-xl px-4 py-3 text-zinc-900 text-sm resize-none focus:outline-none focus:border-rose/40 focus:ring-1 focus:ring-rose/10 transition"
              />
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onReroll}
                className="flex-1 py-3 text-sm font-semibold text-zinc-500 bg-white border border-beige/40 rounded-xl hover:border-rose/30 transition-colors"
              >
                Reroll
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onSend}
                className="flex-1 py-3 text-sm font-bold bg-gradient-to-r from-pink to-rose text-white rounded-xl shadow-lg shadow-rose/15"
              >
                Send the Shame
              </motion.button>
            </div>
          </div>
        ) : error ? (
          <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-3 text-center">
            <p className="text-rose text-sm">{error}</p>
          </div>
        ) : null
      ) : (
        /* Action rituals — contextual description + execute button */
        <div className="space-y-3">
          <div className="bg-white border border-beige/40 rounded-2xl p-5 text-center">
            <p className="text-sm text-zinc-500 leading-relaxed">
              {actionDescription(ritual, victim, target)}
            </p>
          </div>
          {error && (
            <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-3 text-center">
              <p className="text-rose text-sm">{error}</p>
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onSend}
            className="w-full py-3.5 text-sm font-bold bg-gradient-to-r from-pink to-rose text-white rounded-xl shadow-lg shadow-rose/15"
          >
            {ritual.involvesTarget ? "Send the Shame" : "Do It"}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
