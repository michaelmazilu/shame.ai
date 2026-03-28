"use client";

import { motion } from "motion/react";
import type { IGProfile } from "@/lib/types";
import type { Ritual } from "@/lib/rituals";

interface ResultCardProps {
  victim: IGProfile;
  ritual: Ritual;
  target: IGProfile;
  message: string;
  messageLoading: boolean;
  error: string;
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
  onMessageChange,
  onReroll,
  onSend,
}: ResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
      className="w-full max-w-2xl"
    >
      {/* Summary row */}
      <div className="flex items-center justify-center gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-blush/40 rounded-full px-3 py-1.5">
          {victim.profilePic ? (
            <img src={victim.profilePic} alt="" className="w-6 h-6 rounded-full object-cover" draggable={false} />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blush/40 flex items-center justify-center text-[10px] font-bold text-rose">
              {victim.username[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-xs font-semibold text-zinc-700">@{victim.username}</span>
        </div>

        <span className="text-lg">{ritual.emoji}</span>

        <div className="flex items-center gap-2 bg-white border border-blush/40 rounded-full px-3 py-1.5">
          <span className="text-xs text-zinc-400">→</span>
          {target.profilePic ? (
            <img src={target.profilePic} alt="" className="w-6 h-6 rounded-full object-cover" draggable={false} />
          ) : (
            <div className="w-6 h-6 rounded-full bg-blush/40 flex items-center justify-center text-[10px] font-bold text-rose">
              {target.username[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-xs font-semibold text-zinc-700">@{target.username}</span>
        </div>
      </div>

      {/* Message area */}
      {messageLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="w-6 h-6 border-2 border-blush border-t-rose rounded-full"
          />
          <p className="text-sm text-zinc-400 font-medium">Crafting the shame&hellip;</p>
        </div>
      ) : message ? (
        <div className="space-y-3">
          <div className="bg-white border border-blush/40 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-rose animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-semibold">
                {ritual.name}
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={3}
              className="w-full bg-cream-light/50 border border-beige/40 rounded-xl px-4 py-3 text-zinc-900 text-sm resize-none focus:outline-none focus:border-rose/50 focus:ring-2 focus:ring-rose/10 transition"
            />
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onReroll}
              className="flex-1 py-3 text-sm font-semibold text-zinc-500 bg-white border border-beige/60 rounded-xl hover:border-rose/30 transition-colors"
            >
              Reroll message
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSend}
              className="flex-1 py-3 text-sm font-bold bg-gradient-to-r from-pink to-rose text-white rounded-xl shadow-lg shadow-rose/20 hover:shadow-rose/30 transition-shadow"
            >
              Send the Shame
            </motion.button>
          </div>
        </div>
      ) : error ? (
        <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-3 text-center">
          <p className="text-rose text-sm">{error}</p>
        </div>
      ) : null}
    </motion.div>
  );
}
