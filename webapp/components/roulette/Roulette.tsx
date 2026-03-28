"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RITUALS } from "@/lib/rituals";
import { useRouletteState } from "./useRouletteState";
import ResultCard from "./ResultCard";
import { cn } from "@/lib/utils";
import { loadSession, myPlayerToken, type MpSession } from "@/lib/multiplayer-session";
import { mpFetch } from "@/lib/multiplayer-api";

/* ── Types ── */
interface SlotItem { id: string; primary: string; secondary?: string; emoji?: string; pic?: string; }
interface RoomPlayer { id: string; display_name: string; ig_username?: string; role: string; last_seen_at: string; }

function proxyPic(url?: string) {
  if (!url) return undefined;
  return `/api/img-proxy?url=${encodeURIComponent(url)}`;
}

/* ── Vertical Reel ── */

function VerticalReel({ label, icon, spinning, locked, totalTicks, items, selectedIndex, onLocked }: {
  label: string; icon: string; spinning: boolean; locked: boolean; totalTicks: number;
  items: SlotItem[]; selectedIndex: number; onLocked: () => void;
}) {
  const [displayIndex, setDisplayIndex] = useState(-1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const tickRef = useRef(0);
  const lockedRef = useRef(false);

  useEffect(() => {
    if (!spinning || locked || items.length === 0) return;
    lockedRef.current = false;
    tickRef.current = 0;
    const runTick = () => {
      tickRef.current++;
      setDisplayIndex(Math.floor(Math.random() * items.length));
      if (tickRef.current >= totalTicks) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayIndex(selectedIndex);
        if (!lockedRef.current) { lockedRef.current = true; onLocked(); }
      } else if (tickRef.current >= totalTicks - 5 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(runTick, 180);
      }
    };
    intervalRef.current = setInterval(runTick, 65);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [spinning, locked, totalTicks, items.length, selectedIndex, onLocked]);

  useEffect(() => {
    if (!spinning && !locked) { setDisplayIndex(-1); lockedRef.current = false; }
  }, [spinning, locked]);

  const item = displayIndex >= 0 && displayIndex < items.length ? items[displayIndex] : null;
  const proxiedPic = item?.pic ? proxyPic(item.pic) : undefined;

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-xs uppercase tracking-[0.15em] text-zinc-500 font-bold">{label}</span>
        </div>
        {spinning && !locked && (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.4, repeat: Infinity, ease: "linear" }} className="w-3 h-3 border border-rose/30 border-t-rose rounded-full" />
        )}
        {locked && (
          <motion.span initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 12 }} className="text-[9px] uppercase tracking-wider font-bold text-white bg-rose px-2 py-0.5 rounded-full shadow-sm shadow-rose/30">
            Locked
          </motion.span>
        )}
      </div>

      {/* Reel */}
      <motion.div
        animate={
          spinning && !locked
            ? { borderColor: ["rgba(227,107,138,0.1)", "rgba(227,107,138,0.5)", "rgba(227,107,138,0.1)"], boxShadow: ["0 0 0px rgba(227,107,138,0)", "0 4px 30px rgba(227,107,138,0.15)", "0 0 0px rgba(227,107,138,0)"] }
            : locked
              ? { borderColor: "rgba(227,107,138,0.35)", boxShadow: "0 4px 25px rgba(227,107,138,0.1)" }
              : { borderColor: "rgba(214,188,150,0.25)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }
        }
        transition={spinning && !locked ? { duration: 0.5, repeat: Infinity } : { duration: 0.3 }}
        className="rounded-2xl border-2 bg-white overflow-hidden flex-1 flex flex-col relative"
      >
        {/* Top/bottom gradient fade */}
        <div className="absolute inset-0 z-10 pointer-events-none" style={{
          background: "linear-gradient(to bottom, white 0%, transparent 20%, transparent 80%, white 100%)",
        }} />

        {/* Content area */}
        <div className="flex-1 flex items-center justify-center relative z-0 px-4">
          <AnimatePresence mode="popLayout">
            {item ? (
              <motion.div
                key={item.id + displayIndex + (locked ? "L" : "")}
                initial={{ y: 50, opacity: 0, filter: "blur(10px)", scale: 0.85 }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)", scale: 1 }}
                exit={{ y: -50, opacity: 0, filter: "blur(10px)", scale: 0.85 }}
                transition={{ duration: spinning && !locked ? 0.04 : 0.4 }}
                className="flex flex-col items-center text-center w-full"
              >
                {proxiedPic ? (
                  <img src={proxiedPic} alt="" className={cn("w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 mb-3 transition-all", locked ? "ring-rose shadow-2xl shadow-rose/30" : "ring-blush/30")} draggable={false} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : item.emoji ? (
                  <motion.span animate={locked ? { scale: [1, 1.2, 1] } : {}} transition={locked ? { duration: 0.5 } : {}} className="text-7xl sm:text-8xl mb-3">{item.emoji}</motion.span>
                ) : (
                  <div className={cn("w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-4xl font-bold mb-3 transition-all", locked ? "bg-rose text-white shadow-2xl shadow-rose/30" : "bg-blush/20 text-rose")}>
                    {item.primary[0]?.toUpperCase()}
                  </div>
                )}
                <p className={cn("font-bold text-lg sm:text-xl truncate max-w-full leading-tight transition-colors", locked ? "text-rose" : "text-zinc-900")}>{item.primary}</p>
                {item.secondary && <p className="text-xs text-zinc-400 max-w-full mt-1 leading-snug line-clamp-2">{item.secondary}</p>}
              </motion.div>
            ) : (
              <motion.div key="ph" initial={{ opacity: 0 }} animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="flex flex-col items-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blush/10 flex items-center justify-center mb-3">
                  <span className="text-4xl text-blush/50">?</span>
                </div>
                <p className="text-zinc-300 font-bold text-xl">???</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spinning scan line */}
        {spinning && !locked && (
          <motion.div
            animate={{ top: ["10%", "90%", "10%"] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose/40 to-transparent z-10 pointer-events-none"
            style={{ position: "absolute" }}
          />
        )}
      </motion.div>
    </div>
  );
}

/* ── Slot Lever (drag to pull) ── */

function SlotLever({ onPull, disabled }: { onPull: () => void; disabled: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [released, setReleased] = useState(false);
  const [fired, setFired] = useState(false);
  const [shaking, setShaking] = useState(false);
  const threshold = 0.65; // must drag 65% of track to trigger

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled || fired) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [disabled, fired]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (disabled || fired || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const rawY = Math.max(0, Math.min(e.clientY - rect.top - 28, rect.height - 16));
    setDragY(rawY);
  }, [disabled, fired]);

  const handlePointerUp = useCallback(() => {
    if (disabled || fired || !trackRef.current) return;
    const trackH = trackRef.current.getBoundingClientRect().height - 16;
    if (dragY / trackH >= threshold) {
      // Triggered!
      setFired(true);
      setShaking(true);
      onPull();
      setTimeout(() => setShaking(false), 500);
      // Slow return
      setReleased(true);
      setDragY(0);
      setTimeout(() => { setReleased(false); setFired(false); }, 2200);
    } else {
      // Snap back
      setReleased(true);
      setDragY(0);
      setTimeout(() => setReleased(false), 400);
    }
  }, [disabled, fired, dragY, onPull, threshold]);

  const isDragging = dragY > 5 && !released;

  return (
    <div className="flex flex-col items-center select-none h-full justify-center">
      {/* Track */}
      <div ref={trackRef} className="w-4 bg-gradient-to-b from-beige/80 to-gold/30 rounded-full relative cursor-ns-resize" style={{ height: "75%" }}>
        <div className="absolute inset-x-0 top-3 bottom-3 bg-beige/30 rounded-full mx-auto w-1" />

        {/* Notch markers */}
        <div className="absolute left-0 right-0 bottom-[30%] flex justify-center"><div className="w-2 h-0.5 bg-rose/20 rounded-full" /></div>
        <div className="absolute left-0 right-0 bottom-[35%] flex justify-center"><div className="w-3 h-0.5 bg-rose/30 rounded-full" /></div>

        {/* Handle */}
        <motion.div
          animate={{
            y: released ? 0 : dragY,
            x: shaking ? [0, -5, 5, -4, 4, -2, 0] : 0,
            rotate: shaking ? [0, -8, 8, -5, 5, 0] : 0,
          }}
          transition={released
            ? { y: { duration: fired ? 1.8 : 0.3, ease: fired ? [0.16, 1, 0.3, 1] : "easeOut" }, x: { duration: 0.5 }, rotate: { duration: 0.5 } }
            : { y: { duration: 0 }, x: { duration: 0 }, rotate: { duration: 0 } }
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 -top-7 w-16 h-16 rounded-full border-4 border-white shadow-xl flex items-center justify-center touch-none",
            isDragging ? "bg-rose shadow-rose/40 scale-105" : fired ? "bg-rose shadow-rose/40" : "bg-gradient-to-b from-rose to-rose-dark shadow-rose/20",
            disabled && !fired && "opacity-30 cursor-not-allowed",
            !disabled && !fired && "cursor-grab active:cursor-grabbing",
          )}
        >
          <motion.span
            animate={{ rotate: isDragging || fired ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white text-xl font-bold pointer-events-none"
          >
            ↓
          </motion.span>
        </motion.div>
      </div>

      {/* Base */}
      <div className="w-8 h-3 bg-gradient-to-b from-beige/60 to-gold/30 rounded-b-xl mt-0.5" />
      <p className="text-[8px] text-zinc-400 font-semibold mt-1 uppercase tracking-widest">Drag</p>
    </div>
  );
}

/* ── Players Sidebar ── */

function PlayersSidebar({ players }: { players: RoomPlayer[] }) {
  return (
    <div className="w-48 shrink-0 bg-white/50 backdrop-blur-sm border-r border-beige/20 px-3 py-3 overflow-y-auto hidden lg:flex flex-col">
      <p className="text-[9px] uppercase tracking-[0.15em] text-zinc-400 font-bold mb-3 px-1">Players</p>
      <div className="space-y-1 flex-1">
        {players.map((p) => {
          const isOnline = Date.now() - new Date(p.last_seen_at).getTime() < 90_000;
          return (
            <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-blush/10 transition-colors">
              <div className="relative shrink-0">
                <div className="w-7 h-7 rounded-full bg-blush/15 flex items-center justify-center text-[10px] font-bold text-rose/50">{(p.display_name || "?")[0]?.toUpperCase()}</div>
                <div className={cn("absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-white", isOnline ? "bg-emerald-400" : "bg-zinc-300")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-zinc-700 truncate">{p.display_name || "Anonymous"}</p>
                <p className="text-[9px] text-zinc-400">{p.role === "host" ? "Host" : "Player"}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-3 pt-2 border-t border-beige/20">
        <p className="text-[9px] text-zinc-400 text-center">{players.length} player{players.length !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}

/* ── Stats Bar ── */

function StatsBar({ victimCount, ritualCount }: { victimCount: number; ritualCount: number }) {
  return (
    <div className="flex items-center justify-center gap-4 mb-2">
      <div className="flex items-center gap-2 bg-white/60 border border-beige/20 rounded-full px-4 py-1.5">
        <div className="w-2 h-2 rounded-full bg-rose animate-pulse" />
        <span className="text-xs font-medium text-zinc-600">{victimCount} victims</span>
      </div>
      <div className="flex items-center gap-2 bg-white/60 border border-beige/20 rounded-full px-4 py-1.5">
        <span className="text-sm">💀</span>
        <span className="text-xs font-medium text-zinc-600">{ritualCount} rituals</span>
      </div>
    </div>
  );
}

/* ── Main ── */

interface RouletteProps {
  mode?: "solo" | "group";
  groupMembers?: { id: string; username: string; fullName?: string; profilePic?: string }[];
}

export default function Roulette({ mode = "group", groupMembers }: RouletteProps) {
  const state = useRouletteState();
  const isSolo = mode === "solo";
  const [mpSession, setMpSession] = useState<MpSession | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  useEffect(() => { const s = loadSession(); if (s) setMpSession(s); }, []);
  useEffect(() => {
    if (!mpSession) return;
    const token = myPlayerToken(mpSession);
    if (!token) return;
    async function poll() {
      try {
        const data = await mpFetch<{ players?: RoomPlayer[] }>("room-state", { room_id: mpSession!.room_id, player_token: myPlayerToken(mpSession!)! });
        if (data.players) setPlayers(data.players);
      } catch {}
    }
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [mpSession]);

  const profileItems: SlotItem[] = state.profiles.map((p) => ({
    id: p.id, primary: `@${p.username}`, secondary: p.fullName || undefined, pic: p.profilePic || undefined,
  }));
  const ritualItems: SlotItem[] = RITUALS.map((r) => ({
    id: r.id, primary: r.name, secondary: r.description, emoji: r.emoji,
  }));

  const isSpinning = state.phase === "spinning";
  const canSpin = state.phase === "idle" && state.profiles.length > 0;

  // Solo mode: auto-lock victim immediately since you ARE the victim
  useEffect(() => {
    if (isSolo && isSpinning && !state.victimLocked) {
      state.onVictimLocked();
    }
  }, [isSolo, isSpinning, state.victimLocked, state.onVictimLocked]);

  if (state.loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} className="w-10 h-10 border-[3px] border-blush border-t-rose rounded-full" />
        <p className="text-sm text-zinc-500 font-medium">Rounding up victims&hellip;</p>
      </div>
    );
  }

  if (state.profiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
          <p className="text-5xl">😶</p>
        </motion.div>
        <p className="text-lg font-bold text-zinc-900">No victims found</p>
        <p className="text-sm text-zinc-500">Log in or wait for more targets.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {mpSession && players.length > 0 && <PlayersSidebar players={players} />}

      <div className="flex-1 flex flex-col items-center px-6 sm:px-10 py-2 overflow-y-auto">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-1 w-full">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tighter text-zinc-900">
            {isSpinning ? (
              <span className="font-cursive italic text-rose">Choosing fate...</span>
            ) : state.phase === "locked" ? (
              <span className="font-cursive italic text-rose">Locking in...</span>
            ) : state.phase === "result" || state.phase === "sending" ? (
              <span>Fate has <span className="font-cursive italic text-rose">spoken</span>.</span>
            ) : state.phase === "sent" ? (
              <span>Shame <span className="font-cursive italic text-rose">delivered</span>.</span>
            ) : (
              <span>Wheel of <span className="font-cursive italic text-rose">Shame</span></span>
            )}
          </h2>
          <p className="text-sm sm:text-base text-zinc-900 mt-1.5 max-w-lg mx-auto leading-relaxed">
            {isSpinning ? (
              <span>The wheel is spinning. <span className="text-rose font-semibold">No take-backs</span>.</span>
            ) : state.phase === "locked" ? (
              <span>The wheels are <span className="text-rose font-semibold">locking in</span>...</span>
            ) : state.phase === "result" || state.phase === "sending" ? (
              <span>Review the <span className="text-rose font-semibold">ritual</span> and <span className="text-rose font-semibold">send the shame</span> below.</span>
            ) : state.phase === "sent" ? (
              <span>The deed is done. <span className="text-rose font-semibold">Spin again</span> for more chaos.</span>
            ) : isSolo ? (
              <span>Spin to pick a <span className="text-rose font-semibold">ritual</span> and a <span className="text-rose font-semibold">target</span>. Pull the lever or hit the button.</span>
            ) : (
              <span>Spin to pick a <span className="text-rose font-semibold">victim</span>, a <span className="text-rose font-semibold">ritual</span>, and a <span className="text-rose font-semibold">target</span>. Pull the lever or hit the button.</span>
            )}
          </p>
        </motion.div>

        <StatsBar victimCount={state.profiles.length} ritualCount={RITUALS.length} />

        {/* === SLOT MACHINE === */}
        <div className="flex-1 flex items-stretch min-h-0 mb-2 w-full max-w-4xl relative">
          <div className="flex-1 flex items-stretch gap-4">
            {!isSolo && (
              <VerticalReel icon="🎯" label="Victim" spinning={isSpinning} locked={state.victimLocked} totalTicks={18} items={groupMembers?.length ? groupMembers.map((m) => ({ id: m.id, primary: `@${m.username}`, secondary: m.fullName, pic: m.profilePic })) : profileItems} selectedIndex={state.selectedVictimIndex} onLocked={state.onVictimLocked} />
            )}
            <VerticalReel icon="💀" label="Ritual" spinning={isSpinning} locked={state.ritualLocked} totalTicks={isSolo ? 20 : 24} items={ritualItems} selectedIndex={state.selectedRitualIndex} onLocked={state.onRitualLocked} />
            <VerticalReel icon="📩" label="Target" spinning={isSpinning} locked={state.targetLocked} totalTicks={isSolo ? 28 : 30} items={profileItems} selectedIndex={state.selectedTargetIndex} onLocked={state.onTargetLocked} />
          </div>

          <div className="absolute -right-20 top-0 bottom-0 hidden sm:flex w-16">
            <SlotLever onPull={state.spin} disabled={!canSpin} />
          </div>
        </div>

        {/* Button — centred */}
        <div className="mb-2 max-w-2xl mx-auto w-full">
          {state.phase === "idle" && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, boxShadow: "0 0 50px rgba(227,107,138,0.25)" }}
              whileTap={{ scale: 0.97 }}
              onClick={state.spin}
              disabled={!canSpin}
              className="w-full py-4 text-base font-bold bg-gradient-to-r from-pink to-rose text-white rounded-2xl shadow-[0_0_25px_rgba(227,107,138,0.15)] disabled:opacity-40 transition-shadow sm:hidden"
            >
              Spin the Wheel of Shame
            </motion.button>
          )}
          {(state.phase === "spinning" || state.phase === "locked") && (
            <motion.p animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} className="text-center text-rose/50 text-sm font-medium py-1">
              Fate is deciding&hellip;
            </motion.p>
          )}
          {state.phase === "sent" && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={state.reset}
              className="w-full py-3.5 text-sm font-bold bg-white text-zinc-900 rounded-xl border border-beige/40 hover:border-rose/30 transition-colors">
              Spin Again
            </motion.button>
          )}
        </div>

        {/* Result — centred */}
        <div className="max-w-2xl mx-auto w-full">
          <AnimatePresence>
            {state.phase === "result" && state.victim && state.ritual && state.target && (
              <ResultCard victim={state.victim} ritual={state.ritual} target={state.target} message={state.message} messageLoading={state.messageLoading} error={state.error} onMessageChange={state.setMessage} onReroll={state.rerollMessage} onSend={state.sendMessage} />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(state.phase === "sending" || state.phase === "sent") && state.statusText && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={cn("w-full text-center py-2.5 px-4 rounded-xl text-xs font-medium mb-1",
                  state.phase === "sent" && state.statusText.includes("delivered") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : state.phase === "sent" ? "bg-white text-zinc-500 border border-beige/40" : "text-zinc-400"
                )}>
                {state.phase === "sending" && <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} className="inline-block w-3 h-3 border-2 border-beige border-t-rose rounded-full mr-2 align-middle" />}
                {state.statusText}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
