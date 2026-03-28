"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { IGProfile } from "@/lib/types";
import { RITUALS, type Ritual } from "@/lib/rituals";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

type Phase = "idle" | "spinning" | "result" | "sending" | "sent";

interface RouletteProps {
  mode: "solo" | "group";
  groupMembers: IGProfile[];
}

export default function Roulette({ mode, groupMembers }: RouletteProps) {
  const isSolo = mode === "solo";

  const [selfProfile, setSelfProfile] = useState<IGProfile | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  const [displayedUser, setDisplayedUser] = useState<IGProfile | null>(null);
  const [displayedRitual, setDisplayedRitual] = useState<Ritual | null>(null);
  const [finalUser, setFinalUser] = useState<IGProfile | null>(null);
  const [finalRitual, setFinalRitual] = useState<Ritual | null>(null);

  const [message, setMessage] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");

  const spinInterval = useRef<NodeJS.Timeout | null>(null);
  const spinCount = useRef(0);
  const [tick, setTick] = useState(0);

  // In solo mode, build a profile from localStorage (set during login)
  useEffect(() => {
    if (isSolo) {
      const username = localStorage.getItem("st_username") || "you";
      const userId = localStorage.getItem("st_userId") || "self";
      setSelfProfile({ id: userId, username, fullName: "You" });
    }
  }, [isSolo]);

  const victims = isSolo
    ? (selfProfile ? [selfProfile] : [])
    : groupMembers;

  const spin = useCallback(() => {
    if (victims.length === 0) return;
    setPhase("spinning");
    setMessage("");
    setError("");
    setStatusText("");
    spinCount.current = 0;
    setTick(0);

    const totalTicks = 20 + Math.floor(Math.random() * 10);
    const chosenUser = isSolo
      ? victims[0]
      : victims[Math.floor(Math.random() * victims.length)];
    const chosenRitual = RITUALS[Math.floor(Math.random() * RITUALS.length)];

    setFinalUser(chosenUser);
    setFinalRitual(chosenRitual);

    if (isSolo) {
      setDisplayedUser(chosenUser);
    }

    spinInterval.current = setInterval(() => {
      spinCount.current++;
      setTick((t) => t + 1);

      if (!isSolo) {
        setDisplayedUser(victims[Math.floor(Math.random() * victims.length)]);
      }
      setDisplayedRitual(RITUALS[Math.floor(Math.random() * RITUALS.length)]);

      if (spinCount.current >= totalTicks) {
        if (spinInterval.current) clearInterval(spinInterval.current);
        setDisplayedUser(chosenUser);
        setDisplayedRitual(chosenRitual);
        setPhase("result");
        generateMsg(chosenRitual, chosenUser);
      } else if (spinCount.current > totalTicks - 5) {
        if (spinInterval.current) clearInterval(spinInterval.current);
        spinInterval.current = setInterval(() => {
          spinCount.current++;
          setTick((t) => t + 1);
          if (!isSolo) {
            setDisplayedUser(victims[Math.floor(Math.random() * victims.length)]);
          }
          setDisplayedRitual(RITUALS[Math.floor(Math.random() * RITUALS.length)]);

          if (spinCount.current >= totalTicks) {
            if (spinInterval.current) clearInterval(spinInterval.current);
            setDisplayedUser(chosenUser);
            setDisplayedRitual(chosenRitual);
            setPhase("result");
            generateMsg(chosenRitual, chosenUser);
          }
        }, 200);
      }
    }, 80);
  }, [victims, isSolo]);

  async function generateMsg(ritual: Ritual, user: IGProfile) {
    setMessageLoading(true);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ritualPrompt: ritual.prompt, username: user.username }),
      });
      const data = await resp.json();
      if (data.ok) {
        setMessage(data.message);
      } else {
        setError("Failed to generate message");
      }
    } catch {
      setError("Network error");
    } finally {
      setMessageLoading(false);
    }
  }

  async function sendMessage() {
    if (!finalUser || !message.trim()) return;
    setPhase("sending");
    setStatusText("Delivering the shame...");

    try {
      const dmResp = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: finalUser.id, text: message }),
      });
      const dm = await dmResp.json();

      if (dm.success) {
        setStatusText(`Shame delivered to @${finalUser.username}`);
      } else {
        setStatusText("DM failed — they might have restricted messages");
      }

      const history = loadFromStorage<{ profile: { id: string; username: string }; ritual: string; message: string; timestamp: number }[]>("st_shot_history", []);
      history.unshift({
        profile: { id: finalUser.id, username: finalUser.username },
        ritual: finalRitual?.name || "",
        message,
        timestamp: Date.now(),
      });
      if (history.length > 500) history.length = 500;
      saveToStorage("st_shot_history", history);

      setPhase("sent");
    } catch {
      setStatusText("Something went wrong");
      setPhase("sent");
    }
  }

  function reset() {
    setPhase("idle");
    setDisplayedUser(null);
    setDisplayedRitual(null);
    setFinalUser(null);
    setFinalRitual(null);
    setMessage("");
    setError("");
    setStatusText("");
    setTick(0);
  }

  if (victims.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-3 border-blush border-t-rose rounded-full"
        />
        <p className="text-sm text-zinc-400 font-medium">Loading&hellip;</p>
      </div>
    );
  }

  const isSpinning = phase === "spinning";
  const isLocked = phase === "result" || phase === "sending" || phase === "sent";

  return (
    <div className="flex-1 flex flex-col items-center px-5 py-8 overflow-y-auto">

      {/* Title area */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
          {isSpinning
            ? "Choosing fate..."
            : isLocked
              ? "Fate has spoken."
              : isSolo
                ? "What's your punishment?"
                : "Who gets shamed?"}
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          {isSpinning
            ? "No take-backs."
            : isLocked
              ? "Review the damage below."
              : isSolo
                ? "The wheel picks your ritual. You are the victim."
                : `${victims.length} potential victims in the group`}
        </p>
      </motion.div>

      {/* Slot machine area */}
      <div className="w-full max-w-md space-y-4 mb-6">

        {/* Victim slot */}
        <motion.div
          animate={isSpinning && !isSolo ? {
            borderColor: ["rgba(227,107,138,0.2)", "rgba(227,107,138,0.8)", "rgba(227,107,138,0.2)"],
            boxShadow: [
              "0 0 0px rgba(227,107,138,0)",
              "0 0 40px rgba(227,107,138,0.25)",
              "0 0 0px rgba(227,107,138,0)",
            ],
          } : isLocked || isSolo ? {
            borderColor: "rgba(227,107,138,0.6)",
            boxShadow: "0 0 30px rgba(227,107,138,0.15)",
          } : {}}
          transition={isSpinning && !isSolo ? { duration: 0.8, repeat: Infinity } : { duration: 0.3 }}
          className="relative rounded-2xl border-2 border-beige/60 bg-white overflow-hidden"
        >
          <div className="px-5 pt-4 pb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-semibold">
              {isSolo ? "You" : "Victim"}
            </span>
            {isSpinning && !isSolo && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                className="w-3 h-3 border border-rose/50 border-t-rose rounded-full"
              />
            )}
            {(isLocked || isSolo) && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="text-[10px] uppercase tracking-wider font-bold text-rose bg-rose/10 px-2 py-0.5 rounded-full"
              >
                {isSolo ? "Always You" : "Locked"}
              </motion.span>
            )}
          </div>

          <div className="px-5 pb-5 pt-2 min-h-[72px]">
            <AnimatePresence mode="popLayout">
              {displayedUser || isSolo ? (
                <motion.div
                  key={(isSolo ? "self" : displayedUser?.id || "") + tick}
                  initial={isSolo ? { opacity: 0 } : { y: 20, opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={isSolo ? undefined : { y: -20, opacity: 0, filter: "blur(4px)" }}
                  transition={{ duration: isSpinning && !isSolo ? 0.06 : 0.3 }}
                  className="flex items-center gap-4"
                >
                  <div className="relative shrink-0">
                    {(isSolo ? selfProfile : displayedUser)?.profilePic ? (
                      <img
                        src={(isSolo ? selfProfile : displayedUser)!.profilePic!}
                        alt=""
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-blush/60"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blush to-rose/30 flex items-center justify-center text-xl font-bold text-rose ring-2 ring-blush/60">
                        {((isSolo ? selfProfile : displayedUser)?.username?.[0] || "?").toUpperCase()}
                      </div>
                    )}
                    {isSolo && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose rounded-full flex items-center justify-center text-white text-[10px]"
                      >
                        !
                      </motion.div>
                    )}
                    {isLocked && !isSolo && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose rounded-full flex items-center justify-center text-white text-[10px]"
                      >
                        !
                      </motion.div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 truncate text-lg leading-tight">
                      @{(isSolo ? selfProfile : displayedUser)?.username}
                    </p>
                    {(isSolo ? selfProfile : displayedUser)?.fullName && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">
                        {(isSolo ? selfProfile : displayedUser)!.fullName}
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-14 h-14 rounded-full bg-beige/30 flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                  </div>
                  <div>
                    <p className="text-zinc-300 font-bold text-lg">???</p>
                    <p className="text-xs text-zinc-300">Spin to reveal</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex-1 h-px bg-beige/40" />
          <motion.span
            animate={isSpinning ? { rotate: [0, 180, 360] } : {}}
            transition={isSpinning ? { duration: 0.5, repeat: Infinity, ease: "linear" } : {}}
            className="text-lg"
          >
            {isSpinning ? "🎰" : isLocked ? "⚡" : "×"}
          </motion.span>
          <div className="flex-1 h-px bg-beige/40" />
        </div>

        {/* Ritual slot */}
        <motion.div
          animate={isSpinning ? {
            borderColor: ["rgba(227,107,138,0.2)", "rgba(227,107,138,0.8)", "rgba(227,107,138,0.2)"],
            boxShadow: [
              "0 0 0px rgba(227,107,138,0)",
              "0 0 40px rgba(227,107,138,0.25)",
              "0 0 0px rgba(227,107,138,0)",
            ],
          } : isLocked ? {
            borderColor: "rgba(227,107,138,0.6)",
            boxShadow: "0 0 30px rgba(227,107,138,0.15)",
          } : {}}
          transition={isSpinning ? { duration: 0.8, repeat: Infinity, delay: 0.4 } : { duration: 0.3 }}
          className="relative rounded-2xl border-2 border-beige/60 bg-white overflow-hidden"
        >
          <div className="px-5 pt-4 pb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-semibold">Ritual</span>
            {isSpinning && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                className="w-3 h-3 border border-rose/50 border-t-rose rounded-full"
              />
            )}
            {isLocked && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10, delay: 0.1 }}
                className="text-[10px] uppercase tracking-wider font-bold text-rose bg-rose/10 px-2 py-0.5 rounded-full"
              >
                Locked
              </motion.span>
            )}
          </div>

          <div className="px-5 pb-5 pt-2 min-h-[72px]">
            <AnimatePresence mode="popLayout">
              {displayedRitual ? (
                <motion.div
                  key={displayedRitual.id + tick}
                  initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -20, opacity: 0, filter: "blur(4px)" }}
                  transition={{ duration: isSpinning ? 0.06 : 0.3 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{displayedRitual.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 text-lg leading-tight">
                        {displayedRitual.name}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{displayedRitual.description}</p>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-3xl">🎲</span>
                  <div>
                    <p className="text-zinc-300 font-bold text-lg">???</p>
                    <p className="text-xs text-zinc-300">Spin to reveal</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Message preview */}
      <AnimatePresence>
        {phase === "result" && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
            className="w-full max-w-md mb-6"
          >
            {messageLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  className="w-6 h-6 border-2 border-blush border-t-rose rounded-full"
                />
                <p className="text-sm text-zinc-400 font-medium">AI is crafting the shame&hellip;</p>
              </div>
            ) : message ? (
              <div className="space-y-3">
                <div className="bg-white border border-beige/60 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-semibold">
                      Generated message
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full bg-cream-light/50 border border-beige/40 rounded-xl px-4 py-3 text-zinc-900 text-sm resize-none focus:outline-none focus:border-rose/50 focus:ring-2 focus:ring-rose/10 transition"
                  />
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => finalRitual && finalUser && generateMsg(finalRitual, finalUser)}
                    className="flex-1 py-3 text-sm font-semibold text-zinc-500 bg-white border border-beige/60 rounded-xl hover:border-zinc-300 transition-colors"
                  >
                    🎲 Reroll message
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={sendMessage}
                    className="flex-1 py-3 text-sm font-bold bg-rose text-white rounded-xl hover:bg-rose-dark transition-colors shadow-lg shadow-rose/20"
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
        )}
      </AnimatePresence>

      {/* Status */}
      <AnimatePresence>
        {(phase === "sending" || phase === "sent") && statusText && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`w-full max-w-md text-center py-4 px-5 rounded-2xl text-sm font-medium mb-6 ${
              phase === "sent" && statusText.includes("delivered")
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : phase === "sent"
                  ? "bg-white text-zinc-500 border border-beige/60"
                  : "bg-cream text-zinc-400"
            }`}
          >
            {phase === "sending" && (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="inline-block w-3.5 h-3.5 border-2 border-beige border-t-rose rounded-full mr-2 align-middle"
              />
            )}
            {phase === "sent" && statusText.includes("delivered") && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="inline-block mr-1"
              >
                🎯
              </motion.span>
            )}
            {statusText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main action button */}
      <div className="w-full max-w-md">
        {phase === "idle" && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03, boxShadow: "0 0 60px rgba(227,107,138,0.35)" }}
            whileTap={{ scale: 0.97 }}
            onClick={spin}
            className="w-full py-4.5 text-lg font-bold bg-gradient-to-r from-pink to-rose text-white rounded-2xl shadow-[0_0_40px_rgba(227,107,138,0.25)] transition-shadow"
          >
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                🎰
              </motion.span>
              Spin the Wheel of Shame
            </span>
          </motion.button>
        )}
        {phase === "spinning" && (
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="text-center text-zinc-400 text-sm font-medium py-4"
          >
            The wheel decides your fate&hellip;
          </motion.p>
        )}
        {phase === "sent" && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={reset}
            className="w-full py-4.5 text-lg font-bold bg-white text-zinc-900 rounded-2xl border-2 border-beige/60 hover:border-rose/40 transition-colors"
          >
            🔄 Spin Again
          </motion.button>
        )}
      </div>
    </div>
  );
}
