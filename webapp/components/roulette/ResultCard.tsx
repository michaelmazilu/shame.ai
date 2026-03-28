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
  victim, ritual, target, message, messageLoading, error, onMessageChange, onReroll, onSend,
}: ResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
      className="w-full max-w-xl"
    >
      {/* Summary pills */}
      <div className="flex items-center justify-center gap-2 mb-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 bg-white border border-beige/40 rounded-full px-2.5 py-1">
          <div className="w-5 h-5 rounded-full bg-blush/30 flex items-center justify-center text-[9px] font-bold text-rose">{victim.username[0]?.toUpperCase()}</div>
          <span className="text-[11px] font-medium text-zinc-700">@{victim.username}</span>
        </div>
        <span className="text-sm">{ritual.emoji}</span>
        <div className="flex items-center gap-1.5 bg-white border border-beige/40 rounded-full px-2.5 py-1">
          <span className="text-[11px] text-zinc-400">→</span>
          <div className="w-5 h-5 rounded-full bg-blush/30 flex items-center justify-center text-[9px] font-bold text-rose">{target.username[0]?.toUpperCase()}</div>
          <span className="text-[11px] font-medium text-zinc-700">@{target.username}</span>
        </div>
      </div>

      {messageLoading ? (
        <div className="flex flex-col items-center gap-2 py-5">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-blush border-t-rose rounded-full" />
          <p className="text-xs text-zinc-400">Crafting the shame&hellip;</p>
        </div>
      ) : message ? (
        <div className="space-y-2">
          <div className="bg-white border border-beige/40 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1 h-1 rounded-full bg-rose animate-pulse" />
              <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-400 font-semibold">{ritual.name}</span>
            </div>
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={2}
              className="w-full bg-cream-light/60 border border-beige/30 rounded-lg px-3 py-2 text-zinc-900 text-sm resize-none focus:outline-none focus:border-rose/40 focus:ring-1 focus:ring-rose/10 transition"
            />
          </div>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onReroll}
              className="flex-1 py-2.5 text-xs font-semibold text-zinc-500 bg-white border border-beige/40 rounded-lg hover:border-rose/30 transition-colors">
              Reroll
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onSend}
              className="flex-1 py-2.5 text-xs font-bold bg-gradient-to-r from-pink to-rose text-white rounded-lg shadow-md shadow-rose/15">
              Send the Shame
            </motion.button>
          </div>
        </div>
      ) : error ? (
        <div className="bg-rose/10 border border-rose/20 rounded-lg px-3 py-2.5 text-center">
          <p className="text-rose text-xs">{error}</p>
        </div>
      ) : null}
    </motion.div>
  );
}
