"use client";

import { useState, useCallback, useEffect } from "react";
import type { IGProfile, Settings, ShotHistoryEntry, PendingFollow } from "@/lib/types";
import SwipeCard from "./SwipeCard";
import MessageModal from "./MessageModal";

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

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  dmTemplate: "Hey \u2014 I came across your profile and wanted to say hello.",
  maxDMsPerHour: 10,
  aiTone: "casual",
  sources: { suggested: true, explore: true, friendsOfFriends: true },
};

export default function CardStack() {
  const [profiles, setProfiles] = useState<IGProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const [modalProfile, setModalProfile] = useState<IGProfile | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [seen, setSeen] = useState<string[]>([]);
  const [dmsSentThisHour, setDmsSentThisHour] = useState(0);

  useEffect(() => {
    const s = loadFromStorage("st_settings", DEFAULT_SETTINGS);
    setSettings(s);
    const seenIds = loadFromStorage<string[]>("st_seen", []);
    setSeen(seenIds);

    const dmsReset = loadFromStorage<number>("st_dms_reset", 0);
    if (Date.now() - dmsReset > 3600000) {
      setDmsSentThisHour(0);
      saveToStorage("st_dms_hour", 0);
      saveToStorage("st_dms_reset", Date.now());
    } else {
      setDmsSentThisHour(loadFromStorage("st_dms_hour", 0));
    }
  }, []);

  const showStatus = useCallback((text: string, type: "info" | "success" | "error" = "info") => {
    setStatus({ text, type });
    setTimeout(() => setStatus(null), 3000);
  }, []);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      const next = [...prev, id];
      saveToStorage("st_seen", next);
      return next;
    });
  }, []);

  const incrementDMs = useCallback(() => {
    setDmsSentThisHour((prev) => {
      const next = prev + 1;
      saveToStorage("st_dms_hour", next);
      saveToStorage("st_dms_reset", Date.now());
      return next;
    });
  }, []);

  const addToHistory = useCallback((profile: IGProfile) => {
    const history = loadFromStorage<ShotHistoryEntry[]>("st_shot_history", []);
    history.unshift({ profile: { id: profile.id, username: profile.username, fullName: profile.fullName }, timestamp: Date.now() });
    if (history.length > 500) history.length = 500;
    saveToStorage("st_shot_history", history);
  }, []);

  const addPending = useCallback((profile: IGProfile, dmTemplate: string) => {
    const pending = loadFromStorage<PendingFollow[]>("st_pending_follows", []);
    if (pending.some((p) => p.userId === profile.id)) return;
    pending.push({
      userId: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      followedAt: Date.now(),
      dmTemplate,
      status: "pending",
      retries: 0,
    });
    saveToStorage("st_pending_follows", pending);
  }, []);

  // Load profiles on mount
  useEffect(() => {
    async function fetchProfiles() {
      setLoading(true);
      showStatus("Loading profiles\u2026", "info");

      try {
        const resp = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seen, sources: settings.sources }),
        });

        if (resp.status === 401) {
          window.location.href = "/login";
          return;
        }

        const data = await resp.json();
        if (data.profiles?.length) {
          setProfiles(data.profiles);
          showStatus(`${data.profiles.length} profiles loaded`, "success");
        } else {
          showStatus("No profiles found", "info");
        }
      } catch {
        showStatus("Failed to load profiles", "error");
      } finally {
        setLoading(false);
      }
    }

    if (seen !== undefined) {
      fetchProfiles();
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentProfile = profiles[0] || null;

  const handleSwipeLeft = useCallback((profile: IGProfile) => {
    markSeen(profile.id);
    setProfiles((prev) => prev.slice(1));
  }, [markSeen]);

  const handleSwipeRight = useCallback((profile: IGProfile) => {
    setProfiles((prev) => prev.slice(1));
    setModalProfile(profile);
  }, []);

  const handleSendMessage = useCallback(async (profile: IGProfile, message: string) => {
    setModalProfile(null);
    markSeen(profile.id);

    if (dmsSentThisHour >= settings.maxDMsPerHour) {
      showStatus(`Rate limit: ${settings.maxDMsPerHour} DMs/hour reached`, "error");
      return;
    }

    try {
      showStatus("Checking relationship\u2026", "info");
      const relResp = await fetch("/api/relationship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });
      const rel = await relResp.json();

      if (rel.followedBy) {
        showStatus("Sending message\u2026", "info");
        const dmResp = await fetch("/api/dm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profile.id, text: message }),
        });
        const dm = await dmResp.json();

        if (dm.success) {
          incrementDMs();
          addToHistory(profile);
          showStatus(`Message sent to @${profile.username}`, "success");
        } else {
          showStatus("Failed to send \u2014 try again later", "error");
        }
      } else {
        showStatus(`Following @${profile.username}\u2026`, "info");
        const followResp = await fetch("/api/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: profile.id, action: "follow" }),
        });
        const follow = await followResp.json();

        if (follow.success) {
          addPending(profile, message);
          showStatus(`Following @${profile.username} \u2014 will DM when they follow back`, "info");
        } else {
          showStatus("Failed to follow \u2014 try again later", "error");
        }
      }
    } catch {
      showStatus("Error \u2014 try again later", "error");
    }
  }, [dmsSentThisHour, settings.maxDMsPerHour, markSeen, incrementDMs, addToHistory, addPending, showStatus]);

  const handleFallback = useCallback((profile: IGProfile) => {
    setModalProfile(null);
    handleSendMessage(profile, settings.dmTemplate);
  }, [settings.dmTemplate, handleSendMessage]);

  const handleCloseModal = useCallback(() => {
    setModalProfile(null);
  }, []);

  return (
    <div className="relative flex flex-col h-full">
      {/* Card area */}
      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
            <p className="text-sm">Loading profiles&hellip;</p>
          </div>
        )}

        {!loading && !currentProfile && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-500 px-6 text-center">
            <p className="text-lg font-medium">No more profiles</p>
            <p className="text-sm">Check back later or adjust your sources in settings.</p>
          </div>
        )}

        {currentProfile && (
          <SwipeCard
            key={currentProfile.id}
            profile={currentProfile}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
          />
        )}
      </div>

      {/* Action buttons */}
      {currentProfile && (
        <div className="flex gap-4 p-4 justify-center">
          <button
            onClick={() => handleSwipeLeft(currentProfile)}
            className="flex-1 max-w-40 py-3 text-sm font-semibold text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-xl hover:bg-neutral-800 transition"
          >
            Pass
          </button>
          <button
            onClick={() => handleSwipeRight(currentProfile)}
            className="flex-1 max-w-40 py-3 text-sm font-semibold text-black bg-white rounded-xl hover:bg-neutral-200 transition"
          >
            Shoot
          </button>
        </div>
      )}

      {/* Queue counter */}
      <div className="text-center pb-2 text-xs text-neutral-600">
        {profiles.length} in queue
      </div>

      {/* Status toast */}
      {status && (
        <div
          className={`absolute bottom-20 left-4 right-4 text-center text-sm py-2 px-4 rounded-lg transition-opacity ${
            status.type === "success"
              ? "bg-green-900/80 text-green-300"
              : status.type === "error"
                ? "bg-red-900/80 text-red-300"
                : "bg-neutral-800/80 text-neutral-300"
          }`}
        >
          {status.text}
        </div>
      )}

      {/* Message modal */}
      {modalProfile && (
        <MessageModal
          profile={modalProfile}
          settings={settings}
          onSend={handleSendMessage}
          onFallback={handleFallback}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
