"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RITUALS } from "@/lib/rituals";
import { useRouletteState } from "./useRouletteState";
import SpinWheel, { type WheelItemData } from "./SpinWheel";
import ResultCard from "./ResultCard";
import SpinButton from "./SpinButton";

export default function Roulette() {
  const state = useRouletteState();

  const victimItems: WheelItemData[] = useMemo(
    () => state.profiles.map((p) => ({
      id: p.id,
      label: `@${p.username}`,
      sublabel: p.fullName || undefined,
      image: p.profilePic || undefined,
    })),
    [state.profiles],
  );

  const ritualItems: WheelItemData[] = useMemo(
    () => RITUALS.map((r) => ({
      id: r.id,
      label: r.name,
      sublabel: r.description,
      emoji: r.emoji,
    })),
    [],
  );

  // Target uses same profile pool
  const targetItems = victimItems;

  const isSpinning = state.phase === "spinning";

  if (state.loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-3 border-blush border-t-rose rounded-full"
        />
        <p className="text-sm text-zinc-400 font-medium">Rounding up victims&hellip;</p>
      </div>
    );
  }

  if (state.profiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-5xl"
        >
          😶
        </motion.div>
        <p className="text-lg font-bold text-zinc-900">No victims found</p>
        <p className="text-sm text-zinc-500">Log in or wait for more targets.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center px-5 py-6 overflow-y-auto">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
          {isSpinning
            ? "Choosing fate..."
            : state.phase === "locked"
              ? "Locking in..."
              : state.phase === "result" || state.phase === "sending"
                ? "Fate has spoken."
                : state.phase === "sent"
                  ? "Shame delivered."
                  : "Who gets shamed?"}
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          {isSpinning
            ? "No take-backs."
            : state.phase === "idle"
              ? `${state.profiles.length} potential victims`
              : state.phase === "sent"
                ? "Spin again for more chaos."
                : "Review the damage below."}
        </p>
      </motion.div>

      {/* Three wheels */}
      <div className="w-full max-w-2xl flex gap-3 mb-6">
        <SpinWheel
          label="Victim"
          items={victimItems}
          selectedIndex={state.selectedVictimIndex}
          spinning={isSpinning}
          locked={state.victimLocked}
          onLocked={state.onVictimLocked}
          spinDuration={1500}
        />
        <SpinWheel
          label="Ritual"
          items={ritualItems}
          selectedIndex={state.selectedRitualIndex}
          spinning={isSpinning}
          locked={state.ritualLocked}
          onLocked={state.onRitualLocked}
          spinDuration={2200}
        />
        <SpinWheel
          label="Target"
          items={targetItems}
          selectedIndex={state.selectedTargetIndex}
          spinning={isSpinning}
          locked={state.targetLocked}
          onLocked={state.onTargetLocked}
          spinDuration={3000}
        />
      </div>

      {/* Result card */}
      <AnimatePresence>
        {state.phase === "result" && state.victim && state.ritual && state.target && (
          <ResultCard
            victim={state.victim}
            ritual={state.ritual}
            target={state.target}
            message={state.message}
            messageLoading={state.messageLoading}
            error={state.error}
            onMessageChange={state.setMessage}
            onReroll={state.rerollMessage}
            onSend={state.sendMessage}
          />
        )}
      </AnimatePresence>

      {/* Status */}
      <AnimatePresence>
        {(state.phase === "sending" || state.phase === "sent") && state.statusText && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`w-full max-w-2xl text-center py-4 px-5 rounded-2xl text-sm font-medium mb-4 ${
              state.phase === "sent" && state.statusText.includes("delivered")
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : state.phase === "sent"
                  ? "bg-white text-zinc-500 border border-beige/60"
                  : "bg-cream text-zinc-400"
            }`}
          >
            {state.phase === "sending" && (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="inline-block w-3.5 h-3.5 border-2 border-beige border-t-rose rounded-full mr-2 align-middle"
              />
            )}
            {state.statusText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spin button */}
      <SpinButton
        phase={state.phase}
        onSpin={state.spin}
        onReset={state.reset}
        disabled={state.profiles.length === 0}
      />
    </div>
  );
}
