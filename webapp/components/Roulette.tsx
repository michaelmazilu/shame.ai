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

export default function Roulette() {
  const [profiles, setProfiles] = useState<IGProfile[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    async function fetchProfiles() {
      setLoading(true);
      const seen = loadFromStorage<string[]>("st_seen", []);
      try {
        const resp = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seen, sources: { suggested: true, explore: true, friendsOfFriends: true } }),
        });
        if (resp.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await resp.json();
        if (data.profiles?.length) {
          setProfiles(data.profiles);
        }
      } catch {
        setError("Failed to load profiles");
      } finally {
        setLoading(false);
      }
    }
    fetchProfiles();
  }, []);

  const spin = useCallback(() => {
    if (profiles.length === 0) return;
    setPhase("spinning");
    setMessage("");
    setError("");
    setStatusText("");
    spinCount.current = 0;
    setTick(0);

    const totalTicks = 20 + Math.floor(Math.random() * 10);
    const chosenUser = profiles[Math.floor(Math.random() * profiles.length)];
    const chosenRitual = RITUALS[Math.floor(Math.random() * RITUALS.length)];

    setFinalUser(chosenUser);
    setFinalRitual(chosenRitual);

    spinInterval.current = setInterval(() => {
      spinCount.current++;
      setTick((t) => t + 1);

      setDisplayedUser(profiles[Math.floor(Math.random() * profiles.length)]);
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
          setDisplayedUser(profiles[Math.floor(Math.random() * profiles.length)]);
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
  }, [profiles]);

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
      const seen = loadFromStorage<string[]>("st_seen", []);
      seen.push(finalUser.id);
      saveToStorage("st_seen", seen);

      const relResp = await fetch("/api/relationship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: finalUser.id }),
      });
      const rel = await relResp.json();

      if (rel.followedBy) {
        const dmResp = await fetch("/api/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: finalUser.id, text: message }),
        });
        const dm = await dmResp.json();
        if (dm.success) {
          setStatusText(`Shame delivered to @${finalUser.username}`);
          const history = loadFromStorage<{ profile: { id: string; username: string }; ritual: string; message: string; timestamp: number }[]>("st_shot_history", []);
          history.unshift({
            profile: { id: finalUser.id, username: finalUser.username },
            ritual: finalRitual?.name || "",
            message,
            timestamp: Date.now(),
          });
          if (history.length > 500) history.length = 500;
          saveToStorage("st_shot_history", history);
        } else {
          setStatusText("DM failed — they might have restricted messages");
        }
      } else {
        const followResp = await fetch("/api/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: finalUser.id, action: "follow" }),
        });
        const follow = await followResp.json();
        if (follow.success) {
          setStatusText(`Following @${finalUser.username} — shame queued`);
        } else {
          setStatusText("Could not follow — try again");
        }
      }
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
    if (finalUser) {
      setProfiles((prev) => prev.filter((p) => p.id !== finalUser.id));
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-3 border-blush border-t-rose rounded-full"
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-zinc-400 font-medium"
        >
          Rounding up victims&hellip;
        </motion.p>
      </div>
    );
  }

  if (profiles.length === 0) {
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
        <p className="text-sm text-zinc-400">Log in or wait for more targets.</p>
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
          {isSpinning ? "Choosing fate..." : isLocked ? "Fate has spoken." : "Who gets shamed?"}
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          {isSpinning
            ? "No take-backs."
            : isLocked
              ? "Review the damage below."
              : `${profiles.length} potential victims in the pool`}
        </p>
      </motion.div>

      {/* Slot machine area */}
      <div className="w-full max-w-md space-y-4 mb-6">

        {/* Victim slot */}
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
          transition={isSpinning ? { duration: 0.8, repeat: Infinity } : { duration: 0.3 }}
          className="relative rounded-2xl border-2 border-beige/60 bg-white overflow-hidden"
        >
          <div className="px-5 pt-4 pb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-semibold">Victim</span>
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
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="text-[10px] uppercase tracking-wider font-bold text-rose bg-rose/10 px-2 py-0.5 rounded-full"
              >
                Locked
              </motion.span>
            )}
          </div>

          <div className="px-5 pb-5 pt-2 min-h-[72px]">
            <AnimatePresence mode="popLayout">
              {displayedUser ? (
                <motion.div
                  key={displayedUser.id + tick}
                  initial={{ y: 20, opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: -20, opacity: 0, filter: "blur(4px)" }}
                  transition={{ duration: isSpinning ? 0.06 : 0.3 }}
                  className="flex items-center gap-4"
                >
                  <div className="relative shrink-0">
                    {displayedUser.profilePic ? (
                      <img
                        src={displayedUser.profilePic}
                        alt=""
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-blush/60"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blush to-rose/30 flex items-center justify-center text-xl font-bold text-rose ring-2 ring-blush/60">
                        {displayedUser.username[0]?.toUpperCase()}
                      </div>
                    )}
                    {isLocked && (
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
                      @{displayedUser.username}
                    </p>
                    {displayedUser.fullName && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{displayedUser.fullName}</p>
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
