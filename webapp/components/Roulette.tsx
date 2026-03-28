"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

    const totalTicks = 20 + Math.floor(Math.random() * 10);
    const chosenUser = profiles[Math.floor(Math.random() * profiles.length)];
    const chosenRitual = RITUALS[Math.floor(Math.random() * RITUALS.length)];

    setFinalUser(chosenUser);
    setFinalRitual(chosenRitual);

    spinInterval.current = setInterval(() => {
      spinCount.current++;

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
    setStatusText("Sending the shame...");

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
          setStatusText(`Following @${finalUser.username} — shame queued for when they follow back`);
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
    if (finalUser) {
      setProfiles((prev) => prev.filter((p) => p.id !== finalUser.id));
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400">
        <div className="w-8 h-8 border-2 border-beige border-t-rose rounded-full animate-spin" />
        <p className="text-sm">Loading victims&hellip;</p>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-500 px-6 text-center">
        <p className="text-lg font-medium">No victims available</p>
        <p className="text-sm">Log in or check back later.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6">
      <div className="w-full max-w-sm space-y-4">
        {/* Victim slot */}
        <div className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
          phase === "spinning" ? "border-rose/60 shadow-[0_0_30px_rgba(227,107,138,0.15)]" : "border-beige/60"
        } bg-white p-5`}>
          <div className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">Victim</div>
          {displayedUser ? (
            <div className="flex items-center gap-3">
              {displayedUser.profilePic ? (
                <img src={displayedUser.profilePic} alt="" className="w-12 h-12 rounded-full object-cover" draggable={false} />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blush/40 flex items-center justify-center text-lg font-bold text-rose">
                  {displayedUser.username[0]?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className={`font-semibold truncate ${phase === "spinning" ? "text-rose" : "text-zinc-900"}`}>
                  @{displayedUser.username}
                </p>
                {displayedUser.fullName && (
                  <p className="text-xs text-zinc-400 truncate">{displayedUser.fullName}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-zinc-400 text-sm">???</p>
          )}
        </div>

        {/* Ritual slot */}
        <div className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-200 ${
          phase === "spinning" ? "border-rose/60 shadow-[0_0_30px_rgba(227,107,138,0.15)]" : "border-beige/60"
        } bg-white p-5`}>
          <div className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">Ritual</div>
          {displayedRitual ? (
            <div>
              <p className={`text-xl font-bold ${phase === "spinning" ? "text-rose" : "text-zinc-900"}`}>
                {displayedRitual.emoji} {displayedRitual.name}
              </p>
              <p className="text-xs text-zinc-400 mt-1">{displayedRitual.description}</p>
            </div>
          ) : (
            <p className="text-zinc-400 text-sm">???</p>
          )}
        </div>
      </div>

      {/* Message preview */}
      {phase === "result" && (
        <div className="w-full max-w-sm">
          {messageLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-zinc-400">
              <div className="w-4 h-4 border-2 border-beige border-t-rose rounded-full animate-spin" />
              <span className="text-sm">Crafting the shame&hellip;</span>
            </div>
          ) : message ? (
            <div className="space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full bg-white border border-beige/60 rounded-xl px-4 py-3 text-zinc-900 text-sm resize-none focus:outline-none focus:border-rose transition"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => finalRitual && finalUser && generateMsg(finalRitual, finalUser)}
                  className="flex-1 py-2.5 text-sm font-medium text-zinc-500 bg-white border border-beige/60 rounded-xl hover:border-zinc-300 transition"
                >
                  Reroll
                </button>
                <button
                  onClick={sendMessage}
                  className="flex-1 py-2.5 text-sm font-bold bg-rose text-white rounded-xl hover:bg-rose-dark transition"
                >
                  Send the Shame
                </button>
              </div>
            </div>
          ) : error ? (
            <p className="text-rose text-sm text-center">{error}</p>
          ) : null}
        </div>
      )}

      {/* Status */}
      {(phase === "sending" || phase === "sent") && statusText && (
        <div className={`w-full max-w-sm text-center py-3 px-4 rounded-xl text-sm ${
          phase === "sent" && statusText.includes("delivered")
            ? "bg-green-50 text-green-700 border border-green-200"
            : phase === "sent"
              ? "bg-white text-zinc-500 border border-beige/60"
              : "bg-cream text-zinc-400"
        }`}>
          {phase === "sending" && (
            <span className="inline-block w-3 h-3 border-2 border-beige border-t-rose rounded-full animate-spin mr-2 align-middle" />
          )}
          {statusText}
        </div>
      )}

      {/* Main action */}
      <div className="w-full max-w-sm">
        {phase === "idle" && (
          <button
            onClick={spin}
            className="w-full py-4 text-lg font-bold bg-rose text-white rounded-2xl hover:bg-rose-dark active:scale-[0.98] transition-all shadow-[0_0_40px_rgba(227,107,138,0.25)]"
          >
            Spin the Wheel of Shame
          </button>
        )}
        {phase === "spinning" && (
          <div className="text-center text-zinc-400 text-sm animate-pulse">
            Selecting victim and ritual&hellip;
          </div>
        )}
        {phase === "sent" && (
          <button
            onClick={reset}
            className="w-full py-4 text-lg font-bold bg-white text-zinc-900 rounded-2xl border border-beige/60 hover:border-zinc-300 transition"
          >
            Spin Again
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-400">{profiles.length} potential victims</p>
    </div>
  );
}
