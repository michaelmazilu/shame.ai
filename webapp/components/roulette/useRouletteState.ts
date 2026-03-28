"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { IGProfile } from "@/lib/types";
import { RITUALS, type Ritual } from "@/lib/rituals";
import { useTargetPool } from "./useTargetPool";

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

export type Phase =
  | "idle"
  | "spinning"
  | "locked"
  | "result"
  | "sending"
  | "sent";

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
  resultData: Record<string, unknown> | null;
  selectedVictimIndex: number;
  selectedRitualIndex: number;
  selectedTargetIndex: number;
  setMessage: (msg: string) => void;
  spin: () => void;
  executePunishment: () => void;
  reset: () => void;
  onVictimLocked: () => void;
  onRitualLocked: () => void;
  onTargetLocked: () => void;
  rerollMessage: () => void;
}

export function useRouletteState(): RouletteState {
  const pool = useTargetPool();
  const profiles = pool.targets;
  const loading = pool.loading;

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
  const [error, setError] = useState(pool.error);
  const [statusText, setStatusText] = useState("");
  const [resultData, setResultData] = useState<Record<string, unknown> | null>(
    null,
  );

  const messageGenerated = useRef(false);

  useEffect(() => {
    if (pool.error) setError(pool.error);
  }, [pool.error]);

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
        body: JSON.stringify({
          ritualPrompt: r.prompt,
          profile: {
            username: u.username,
            fullName: u.fullName,
            bio: u.bio,
            categoryName: u.categoryName,
            recentCaptions: u.recentPosts
              ?.slice(0, 3)
              .map((p) => p.caption)
              .filter(Boolean),
          },
        }),
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
    setResultData(null);
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
  }, []);

  const onTargetLocked = useCallback(() => {
    setTargetLocked(true);
    // Only generate message for DM rituals that need editable text
    if (!messageGenerated.current && ritual && target && ritual.needsMessage) {
      messageGenerated.current = true;
      generateMsg(ritual, target);
    }
  }, [ritual, target]);

  const rerollMessage = useCallback(() => {
    if (ritual && target && ritual.needsMessage) generateMsg(ritual, target);
  }, [ritual, target]);

  const executePunishment = useCallback(async () => {
    if (!ritual || !victim) return;
    if (ritual.needsMessage && !message.trim()) return;
    setPhase("sending");
    setStatusText("Delivering the shame...");

    try {
      const seen = loadStorage<string[]>("st_seen", []);
      seen.push(victim.id);
      if (target && target.id !== victim.id) seen.push(target.id);
      saveStorage("st_seen", seen);

      const resp = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: ritual.action,
          victimId: victim.id,
          victimUsername: victim.username,
          targetId: target?.id,
          targetUsername: target?.username,
          message: ritual.needsMessage ? message : undefined,
        }),
      });

      const data = await resp.json();
      setResultData(data);

      if (data.success) {
        switch (ritual.action) {
          case "dm":
            setStatusText(
              `Shame delivered to @${target?.username || victim.username}`,
            );
            break;
          case "dm_confession":
            setStatusText(
              `AI confession sent to @${target?.username || victim.username}`,
            );
            break;
          case "comment":
            setStatusText("Comment dropped on a random reel");
            break;
          case "send_reel":
            setStatusText(
              `Random reel sent to @${target?.username || victim.username}`,
            );
            break;
          case "story_image":
            setStatusText("AI meme posted to your story");
            break;
          case "story_reel":
            setStatusText("Reel reposted to your story");
            break;
          case "story_video":
            setStatusText("AI video generation started");
            break;
        }

        const history = loadStorage<
          {
            profile: { id: string; username: string };
            target: { id: string; username: string };
            ritual: string;
            message: string;
            timestamp: number;
          }[]
        >("st_shot_history", []);
        history.unshift({
          profile: { id: victim.id, username: victim.username },
          target: { id: target?.id || "", username: target?.username || "" },
          ritual: ritual.name,
          message: message || ritual.description,
          timestamp: Date.now(),
        });
        if (history.length > 500) history.length = 500;
        saveStorage("st_shot_history", history);
      } else {
        setStatusText(data.error || "Something went wrong");
      }

      setPhase("sent");
    } catch {
      setStatusText("Something went wrong");
      setPhase("sent");
    }
  }, [target, victim, ritual, message]);

  const reset = useCallback(() => {
    if (victim) pool.markUsed(victim.id);
    if (target && target.id !== victim?.id) pool.markUsed(target.id);
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
    setResultData(null);
    messageGenerated.current = false;
  }, [victim, target, pool]);

  return {
    profiles,
    loading,
    phase,
    victim,
    ritual,
    target,
    victimLocked,
    ritualLocked,
    targetLocked,
    message,
    messageLoading,
    error,
    statusText,
    resultData,
    selectedVictimIndex,
    selectedRitualIndex,
    selectedTargetIndex,
    setMessage,
    spin,
    executePunishment,
    reset,
    onVictimLocked,
    onRitualLocked,
    onTargetLocked,
    rerollMessage,
  };
}
