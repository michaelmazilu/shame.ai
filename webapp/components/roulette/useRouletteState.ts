"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { IGProfile } from "@/lib/types";
import { RITUALS, type Ritual } from "@/lib/rituals";

function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export type Phase = "idle" | "spinning" | "locked" | "result" | "sending" | "sent";

export interface RouletteState {
  profiles: IGProfile[];
  loading: boolean;
  phase: Phase;
  victim: IGProfile | null;
  ritual: Ritual | null;
  target: IGProfile | null;
  victimLocked: boolean;
  ritualLocked: boolean;
  targetLocked: boolean;
  message: string;
  messageLoading: boolean;
  error: string;
  statusText: string;
  selectedVictimIndex: number;
  selectedRitualIndex: number;
  selectedTargetIndex: number;
  setMessage: (msg: string) => void;
  spin: () => void;
  sendMessage: () => void;
  reset: () => void;
  onVictimLocked: () => void;
  onRitualLocked: () => void;
  onTargetLocked: () => void;
  rerollMessage: () => void;
}

export function useRouletteState(): RouletteState {
  const [profiles, setProfiles] = useState<IGProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");

  const [victim, setVictim] = useState<IGProfile | null>(null);
  const [ritual, setRitual] = useState<Ritual | null>(null);
  const [target, setTarget] = useState<IGProfile | null>(null);

  const [victimLocked, setVictimLocked] = useState(false);
  const [ritualLocked, setRitualLocked] = useState(false);
  const [targetLocked, setTargetLocked] = useState(false);

  const [selectedVictimIndex, setSelectedVictimIndex] = useState(0);
  const [selectedRitualIndex, setSelectedRitualIndex] = useState(0);
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);

  const [message, setMessage] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("");

  const messageGenerated = useRef(false);

  // Load profiles
  useEffect(() => {
    async function fetchProfiles() {
      setLoading(true);
      const seen = loadStorage<string[]>("st_seen", []);
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
        if (data.profiles?.length) setProfiles(data.profiles);
      } catch {
        setError("Failed to load profiles");
      } finally {
        setLoading(false);
      }
    }
    fetchProfiles();
  }, []);

  // Check if all wheels locked → transition to result
  useEffect(() => {
    if (phase === "spinning" && victimLocked && ritualLocked && targetLocked) {
      const timer = setTimeout(() => setPhase("result"), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, victimLocked, ritualLocked, targetLocked]);

  async function generateMsg(r: Ritual, u: IGProfile) {
    setMessageLoading(true);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ritualPrompt: r.prompt, username: u.username }),
      });
      const data = await resp.json();
      if (data.ok) setMessage(data.message);
      else setError("Failed to generate message");
    } catch {
      setError("Network error");
    } finally {
      setMessageLoading(false);
    }
  }

  const spin = useCallback(() => {
    if (profiles.length === 0) return;
    setPhase("spinning");
    setMessage("");
    setError("");
    setStatusText("");
    setVictimLocked(false);
    setRitualLocked(false);
    setTargetLocked(false);
    messageGenerated.current = false;

    const vi = Math.floor(Math.random() * profiles.length);
    const ri = Math.floor(Math.random() * RITUALS.length);
    let ti = Math.floor(Math.random() * profiles.length);
    if (profiles.length > 1) {
      while (ti === vi) ti = Math.floor(Math.random() * profiles.length);
    }

    setSelectedVictimIndex(vi);
    setSelectedRitualIndex(ri);
    setSelectedTargetIndex(ti);
    setVictim(profiles[vi]);
    setRitual(RITUALS[ri]);
    setTarget(profiles[ti]);
  }, [profiles]);

  const onVictimLocked = useCallback(() => {
    setVictimLocked(true);
  }, []);

  const onRitualLocked = useCallback(() => {
    setRitualLocked(true);
    // Fire message generation as soon as we know ritual + victim
    if (!messageGenerated.current && ritual && victim) {
      messageGenerated.current = true;
      generateMsg(ritual, victim);
    }
  }, [ritual, victim]);

  const onTargetLocked = useCallback(() => {
    setTargetLocked(true);
  }, []);

  const rerollMessage = useCallback(() => {
    if (ritual && victim) generateMsg(ritual, victim);
  }, [ritual, victim]);

  const sendMessage = useCallback(async () => {
    if (!target || !message.trim()) return;
    setPhase("sending");
    setStatusText("Delivering the shame...");

    try {
      const seen = loadStorage<string[]>("st_seen", []);
      if (victim) seen.push(victim.id);
      if (target.id !== victim?.id) seen.push(target.id);
      saveStorage("st_seen", seen);

      const relResp = await fetch("/api/relationship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      });
      const rel = await relResp.json();

      if (rel.followedBy) {
        const dmResp = await fetch("/api/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: target.id, text: message }),
        });
        const dm = await dmResp.json();
        if (dm.success) {
          setStatusText(`Shame delivered to @${target.username}`);
          const history = loadStorage<{ profile: { id: string; username: string }; target: { id: string; username: string }; ritual: string; message: string; timestamp: number }[]>("st_shot_history", []);
          history.unshift({
            profile: { id: victim?.id || "", username: victim?.username || "" },
            target: { id: target.id, username: target.username },
            ritual: ritual?.name || "",
            message,
            timestamp: Date.now(),
          });
          if (history.length > 500) history.length = 500;
          saveStorage("st_shot_history", history);
        } else {
          setStatusText("DM failed — they might have restricted messages");
        }
      } else {
        const followResp = await fetch("/api/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: target.id, action: "follow" }),
        });
        const follow = await followResp.json();
        if (follow.success) {
          setStatusText(`Following @${target.username} — shame queued`);
        } else {
          setStatusText("Could not follow — try again");
        }
      }
      setPhase("sent");
    } catch {
      setStatusText("Something went wrong");
      setPhase("sent");
    }
  }, [target, victim, ritual, message]);

  const reset = useCallback(() => {
    setPhase("idle");
    setVictim(null);
    setRitual(null);
    setTarget(null);
    setVictimLocked(false);
    setRitualLocked(false);
    setTargetLocked(false);
    setMessage("");
    setError("");
    setStatusText("");
    messageGenerated.current = false;
    // Remove used profiles from pool
    setProfiles((prev) => prev.filter((p) => p.id !== victim?.id && p.id !== target?.id));
  }, [victim, target]);

  return {
    profiles, loading, phase,
    victim, ritual, target,
    victimLocked, ritualLocked, targetLocked,
    message, messageLoading, error, statusText,
    selectedVictimIndex, selectedRitualIndex, selectedTargetIndex,
    setMessage, spin, sendMessage, reset,
    onVictimLocked, onRitualLocked, onTargetLocked, rerollMessage,
  };
}
