"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ShameEntry {
  profile: { id: string; username: string };
  ritual: string;
  message: string;
  timestamp: number;
}

function timeSince(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<ShameEntry[]>([]);

  useEffect(() => {
    try {
      const h = localStorage.getItem("st_shot_history");
      if (h) setHistory(JSON.parse(h));
    } catch { /* empty */ }
  }, []);

  return (
    <main className="min-h-dvh bg-cream-light text-zinc-900">
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-beige/40">
        <Link href="/app" className="text-sm text-zinc-400 hover:text-zinc-900 transition">
          &larr; Back
        </Link>
        <h1 className="text-sm font-bold tracking-tight">
          shame<span className="text-rose">.ai</span> <span className="text-zinc-400 font-normal">/ log</span>
        </h1>
        <div className="w-12" />
      </header>

      <div className="max-w-md mx-auto px-5 py-6 space-y-6">
        <div className="text-center py-4 bg-white rounded-xl border border-beige/60">
          <div className="text-3xl font-bold tabular-nums text-rose">{history.length}</div>
          <div className="text-xs text-zinc-400 mt-1">People Shamed</div>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">
            No one has been shamed yet. Spin the wheel.
          </p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 50).map((entry, i) => (
              <div key={i} className="bg-white rounded-xl border border-beige/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-900">@{entry.profile.username}</span>
                  <span className="text-[10px] text-zinc-400">{timeSince(entry.timestamp)} ago</span>
                </div>
                {entry.ritual && (
                  <div className="text-xs text-rose font-medium">{entry.ritual}</div>
                )}
                <p className="text-xs text-zinc-500 leading-relaxed">{entry.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
