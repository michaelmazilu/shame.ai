"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import Roulette from "@/components/Roulette";
import GroupRoomPanel from "@/components/GroupRoomPanel";

type AppStep = "pick-mode" | "group-room" | "playing";
type GameMode = "solo" | "group";

export default function AppPage() {
  const [step, setStep] = useState<AppStep>("pick-mode");
  const [mode, setMode] = useState<GameMode>("solo");

  function startSolo() {
    setMode("solo");
    setStep("playing");
  }

  function startGroup() {
    setMode("group");
    setStep("group-room");
  }

  function backToMenu() {
    setStep("pick-mode");
  }

  return (
    <main className="h-dvh bg-cream flex flex-col overflow-hidden relative">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-rose/10 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[250px] h-[250px] bg-pink/8 rounded-full blur-[80px]" />
      <div className="pointer-events-none absolute top-1/2 left-0 w-[200px] h-[200px] bg-blush/10 rounded-full blur-[80px]" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-5 py-2 bg-cream/80 backdrop-blur-md border-b border-beige/30 sticky top-0 z-20 relative"
      >
        {step === "pick-mode" ? (
          <Link href="/" className="text-sm font-bold tracking-tight text-zinc-900">
            shame<span className="text-rose">.ai</span>
          </Link>
        ) : (
          <button
            onClick={backToMenu}
            className="text-sm text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            &larr; Back
          </button>
        )}
        <div className="flex items-center gap-2">
          {step !== "pick-mode" && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-rose bg-rose/10 px-2.5 py-1 rounded-full">
              {mode === "solo" ? "Solo" : "Group room"}
            </span>
          )}
          <Link href="/history" className="text-xs font-semibold text-rose bg-rose/10 hover:bg-rose/20 transition-colors px-4 py-1.5 rounded-full">History</Link>
          <Link href="/settings" className="text-xs font-semibold text-rose bg-rose/10 hover:bg-rose/20 transition-colors px-4 py-1.5 rounded-full">Settings</Link>
          <Link href="/room" className="text-xs font-semibold text-white bg-rose hover:bg-rose-dark transition-colors px-4 py-1.5 rounded-full">Room</Link>
        </div>
      </motion.header>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
          {step === "pick-mode" && (
            <motion.div
              key="pick-mode"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-center px-6 gap-8"
            >
              <div className="text-center">
                <motion.h1
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900"
                >
                  How are you playing?
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-zinc-400 mt-2"
                >
                  Choose your fate
                </motion.p>
              </div>

              <div className="w-full max-w-sm space-y-4">
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 }}
                  whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(227,107,138,0.2)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startSolo}
                  className="w-full bg-white border-2 border-beige/60 rounded-2xl p-6 text-left hover:border-rose/40 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🎯</span>
                    <div>
                      <p className="text-lg font-bold text-zinc-900 group-hover:text-rose transition-colors">
                        Solo
                      </p>
                      <p className="text-sm text-zinc-400 mt-0.5">
                        You are the victim. The wheel picks your ritual.
                      </p>
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(227,107,138,0.2)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startGroup}
                  className="w-full bg-white border-2 border-beige/60 rounded-2xl p-6 text-left hover:border-rose/40 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">👥</span>
                    <div>
                      <p className="text-lg font-bold text-zinc-900 group-hover:text-rose transition-colors">
                        Group
                      </p>
                      <p className="text-sm text-zinc-400 mt-0.5">
                        Create or join a room with a code. Synced multiplayer lobby.
                      </p>
                    </div>
                  </div>
                </motion.button>
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs text-zinc-300"
              >
                No take-backs once the wheel spins.
              </motion.p>
            </motion.div>
          )}

          {step === "group-room" && (
            <motion.div
              key="group-room"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <GroupRoomPanel />
            </motion.div>
          )}

          {step === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <Roulette mode="solo" groupMembers={[]} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
