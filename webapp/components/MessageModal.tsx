"use client";

import { useState, useEffect, useCallback } from "react";
import type { IGProfile, Settings } from "@/lib/types";

interface MessageModalProps {
  profile: IGProfile;
  settings: Settings;
  onSend: (profile: IGProfile, message: string) => void;
  onFallback: (profile: IGProfile) => void;
  onClose: () => void;
}

export default function MessageModal({ profile, settings, onSend, onFallback, onClose }: MessageModalProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");
  const [sending, setSending] = useState(false);

  const requestGenerate = useCallback(async () => {
    setState("loading");
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: settings.aiTone || "casual" }),
      });
      const data = await resp.json();
      if (data.ok) {
        setMessage(data.message);
        setState("ready");
      } else {
        setErrorText("Could not generate message. Try again.");
        setState("error");
      }
    } catch {
      setErrorText("Network error. Check your connection.");
      setState("error");
    }
  }, [settings.aiTone]);

  useEffect(() => {
    requestGenerate();
  }, [requestGenerate]);

  function handleSend() {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    onSend(profile, text);
  }

  function handleFallback() {
    onFallback(profile);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-neutral-900 rounded-t-2xl sm:rounded-2xl border border-neutral-800 overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <span className="text-sm font-semibold text-white">
            Message for @{profile.username}
          </span>
          <button onClick={onClose} className="text-sm text-neutral-400 hover:text-white transition">
            Cancel
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {state === "loading" && (
            <div className="flex items-center justify-center gap-3 py-8 text-neutral-400">
              <div className="w-5 h-5 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
              <span className="text-sm">Generating message&hellip;</span>
            </div>
          )}

          {state === "ready" && (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-white transition"
              autoFocus
            />
          )}

          {state === "error" && (
            <p className="text-red-400 text-sm text-center py-4">{errorText}</p>
          )}
        </div>

        {/* Actions */}
        {state === "ready" && (
          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={requestGenerate}
              className="flex-1 py-2.5 text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition"
            >
              Reroll
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="flex-1 py-2.5 text-sm font-semibold bg-white text-black rounded-lg disabled:opacity-40 hover:bg-neutral-200 transition"
            >
              {sending ? "Sending\u2026" : "Send"}
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="flex gap-3 px-5 pb-5">
            <button
              onClick={requestGenerate}
              className="flex-1 py-2.5 text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition"
            >
              Retry
            </button>
            <button
              onClick={handleFallback}
              className="flex-1 py-2.5 text-sm font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition"
            >
              Use fallback
            </button>
          </div>
        )}

        {/* Safe area padding for mobile */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
