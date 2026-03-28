"use client";

import { motion } from "motion/react";
import type { Phase } from "./useRouletteState";

interface SpinButtonProps {
  phase: Phase;
  onSpin: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export default function SpinButton({ phase, onSpin, onReset, disabled }: SpinButtonProps) {
  if (phase === "idle") {
    return (
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.03, boxShadow: "0 0 50px rgba(227,107,138,0.3)" }}
        whileTap={{ scale: 0.97 }}
        onClick={onSpin}
        disabled={disabled}
        className="w-full max-w-2xl py-4 text-base font-bold bg-gradient-to-r from-pink to-rose text-white rounded-2xl shadow-[0_0_30px_rgba(227,107,138,0.2)] disabled:opacity-40 transition-shadow"
      >
        Spin the Wheel of Shame
      </motion.button>
    );
  }

  if (phase === "spinning" || phase === "locked") {
    return (
      <motion.p
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Infinity }}
        className="text-center text-zinc-400 text-sm font-medium py-4"
      >
        Fate is deciding&hellip;
      </motion.p>
    );
  }

  if (phase === "sent") {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onReset}
        className="w-full max-w-2xl py-4 text-base font-bold bg-white text-zinc-900 rounded-2xl border-2 border-beige/60 hover:border-rose/40 transition-colors"
      >
        Spin Again
      </motion.button>
    );
  }

  return null;
}
