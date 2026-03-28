"use client";

import { motion } from "motion/react";
import type { IGProfile } from "@/lib/types";
import type { Ritual } from "@/lib/rituals";

function proxyPic(url?: string) {
  if (!url) return undefined;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

function Avatar({ user, size = "sm" }: { user: IGProfile; size?: "sm" | "md" }) {
  const pic = proxyPic(user.profilePic);
  const s = size === "md" ? "w-10 h-10" : "w-7 h-7";
  const text = size === "md" ? "text-sm" : "text-[10px]";

  if (pic) {
    return <img src={pic} alt="" className={`${s} rounded-full object-cover ring-2 ring-blush/30 shrink-0`} draggable={false} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div className={`${s} rounded-full bg-blush/30 flex items-center justify-center ${text} font-bold text-rose shrink-0`}>
      {user.username[0]?.toUpperCase()}
    </div>
  );
}

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
      className="w-full"
    >
      {/* Summary pills */}
      <div className="flex items-center justify-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-beige/40 rounded-full px-3 py-1.5">
          <Avatar user={victim} size="md" />
          <span className="text-sm font-semibold text-zinc-800">@{victim.username}</span>
        </div>
        <span className="text-2xl">{ritual.emoji}</span>
        <div className="flex items-center gap-2 bg-white border border-beige/40 rounded-full px-3 py-1.5">
          <span className="text-sm text-zinc-400">→</span>
          <Avatar user={target} size="md" />
          <span className="text-sm font-semibold text-zinc-800">@{target.username}</span>
        </div>
      </div>

      {messageLoading ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} className="w-6 h-6 border-2 border-blush border-t-rose rounded-full" />
          <p className="text-sm text-zinc-400">Crafting the shame&hellip;</p>
        </div>
      ) : message ? (
        <div className="space-y-3">
          <div className="bg-white border border-beige/40 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-rose animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-400 font-semibold">{ritual.name}</span>
            </div>
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={3}
              className="w-full bg-cream-light/60 border border-beige/30 rounded-xl px-4 py-3 text-zinc-900 text-sm resize-none focus:outline-none focus:border-rose/40 focus:ring-1 focus:ring-rose/10 transition"
            />
          </div>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onReroll}
              className="flex-1 py-3 text-sm font-semibold text-zinc-500 bg-white border border-beige/40 rounded-xl hover:border-rose/30 transition-colors">
              Reroll
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onSend}
              className="flex-1 py-3 text-sm font-bold bg-gradient-to-r from-pink to-rose text-white rounded-xl shadow-lg shadow-rose/15">
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
