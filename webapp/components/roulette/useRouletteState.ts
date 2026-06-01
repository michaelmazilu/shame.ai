"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { IGProfile } from "@/lib/types";
import { RITUALS, ritualKind, type Ritual } from "@/lib/rituals";
import { localRitualMessage } from "@/lib/local-message";
import { useTargetPool } from "./useTargetPool";

/** Fill an image-gen template: {message} → generated text, {target} → @username. */
function buildImagePrompt(r: Ritual, message: string, targetUsername: string) {
  return (r.imagePrompt || "")
    .replace(/\{message\}/g, message)
    .replace(/\{target\}/g, `@${targetUsername}`);
}

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
  // Generation is now instant (local templates), so this is always false — kept
  // only to satisfy the ResultCard prop.
  const [messageLoading] = useState(false);
  const [error, setError] = useState(pool.error);
  const [statusText, setStatusText] = useState("");

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

  // No AI: messages come from hardcoded local templates so the wheel works
  // instantly and offline. (See lib/local-message.ts.)
  function generateMsg(r: Ritual, subjectUsername: string) {
    setError("");
    setMessage(localRitualMessage(r, subjectUsername));
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
    // Fire message generation as soon as we know ritual + victim. Every ritual
    // is directed at the target.
    if (!messageGenerated.current && ritual && victim) {
      messageGenerated.current = true;
      generateMsg(ritual, (target || victim).username);
    }
  }, [ritual, victim, target]);

  const onTargetLocked = useCallback(() => {
    setTargetLocked(true);
  }, []);

  const rerollMessage = useCallback(() => {
    if (ritual && victim) generateMsg(ritual, (target || victim).username);
  }, [ritual, victim, target]);

  const sendMessage = useCallback(async () => {
    if (!target || !ritual) return;
    const kind = ritualKind(ritual);
    // The pic swap is image-only; every other deed needs the generated text.
    if (kind !== "pfp" && !message.trim()) return;

    setPhase("sending");
    setStatusText("Delivering the shame...");

    const jsonHeaders = { "Content-Type": "application/json" };
    const recordHistory = () => {
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
        profile: { id: victim?.id || "", username: victim?.username || "" },
        target: { id: target.id, username: target.username },
        ritual: ritual.name,
        message,
        timestamp: Date.now(),
      });
      if (history.length > 500) history.length = 500;
      saveStorage("st_shot_history", history);
    };

    try {
      const seen = loadStorage<string[]>("st_seen", []);
      if (victim) seen.push(victim.id);
      if (target.id !== victim?.id) seen.push(target.id);
      saveStorage("st_seen", seen);

      if (kind === "bio") {
        const resp = await fetch("/api/profile-edit", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ biography: message }),
        });
        const data = await resp.json();
        if (data.success) {
          setStatusText("✅ Your bio is now a public confession — go look 💀");
          recordHistory();
        } else {
          setStatusText("Couldn't change your bio — try again");
        }
      } else if (kind === "story") {
        const resp = await fetch("/api/story", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            action: "photo",
            genPrompt: buildImagePrompt(ritual, message, target.username),
          }),
        });
        const data = await resp.json();
        if (data.success) {
          setStatusText("✅ Posted to your story for all your followers 💀");
          recordHistory();
        } else {
          setStatusText(data.error || "Couldn't post the story — try again");
        }
      } else if (kind === "pfp") {
        const resp = await fetch("/api/pfp", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            genPrompt: buildImagePrompt(ritual, message, target.username),
          }),
        });
        const data = await resp.json();
        if (data.success) {
          setStatusText(
            "✅ Profile picture swapped — good luck explaining that 💀",
          );
          recordHistory();
        } else {
          setStatusText(data.error || "Couldn't swap your pic — try again");
        }
      } else {
        // Default DM flow: DM if they follow you, otherwise follow + queue.
        const relResp = await fetch("/api/relationship", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ userId: target.id }),
        });
        const rel = await relResp.json();

        if (rel.followedBy) {
          const dmResp = await fetch("/api/dm", {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify({ userId: target.id, text: message }),
          });
          const dm = await dmResp.json();
          if (dm.success) {
            setStatusText(`✅ Shame delivered to @${target.username}`);
            recordHistory();
          } else {
            setStatusText("DM failed — they might have restricted messages");
          }
        } else {
          const followResp = await fetch("/api/follow", {
            method: "POST",
            headers: jsonHeaders,
            body: JSON.stringify({ userId: target.id, action: "follow" }),
          });
          const follow = await followResp.json();
          if (follow.success) {
            setStatusText(`Following @${target.username} — shame queued`);
          } else {
            setStatusText("Could not follow — try again");
          }
        }
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
    selectedVictimIndex,
    selectedRitualIndex,
    selectedTargetIndex,
    setMessage,
    spin,
    sendMessage,
    reset,
    onVictimLocked,
    onRitualLocked,
    onTargetLocked,
    rerollMessage,
  };
}
