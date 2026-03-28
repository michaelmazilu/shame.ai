"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ShotHistoryEntry, PendingFollow } from "@/lib/types";

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
  const [history, setHistory] = useState<ShotHistoryEntry[]>([]);
  const [pending, setPending] = useState<PendingFollow[]>([]);

  useEffect(() => {
    try {
      const h = localStorage.getItem("st_shot_history");
      if (h) setHistory(JSON.parse(h));
      const p = localStorage.getItem("st_pending_follows");
      if (p) setPending(JSON.parse(p).filter((x: PendingFollow) => x.status === "pending"));
    } catch { /* empty */ }
  }, []);

  return (
    <main className="min-h-dvh bg-black text-white">
      <header className="flex items-center justify-between px-5 py-3 bg-neutral-950 border-b border-neutral-800">
        <Link href="/" className="text-sm text-neutral-400 hover:text-white transition">
          &larr; Back
        </Link>
        <h1 className="text-sm font-bold tracking-widest uppercase">History</h1>
        <div className="w-12" />
      </header>

      <div className="max-w-md mx-auto px-5 py-6 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center py-4 bg-neutral-900 rounded-xl border border-neutral-800">
            <div className="text-2xl font-bold tabular-nums">{history.length}</div>
            <div className="text-xs text-neutral-500 mt-1">Messages</div>
          </div>
          <div className="text-center py-4 bg-neutral-900 rounded-xl border border-neutral-800">
            <div className="text-2xl font-bold tabular-nums">{pending.length}</div>
            <div className="text-xs text-neutral-500 mt-1">Pending</div>
          </div>
          <div className="text-center py-4 bg-neutral-900 rounded-xl border border-neutral-800">
            <div className="text-2xl font-bold tabular-nums">
              {(() => { try { const s = localStorage.getItem("st_seen"); return s ? JSON.parse(s).length : 0; } catch { return 0; } })()}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Seen</div>
          </div>
        </div>

        {/* Pending Follow-Backs */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">
              Pending Follow-Backs
            </h2>
            <div className="space-y-1">
              {pending.map((p) => (
                <div key={p.userId} className="flex items-center justify-between py-2.5 px-3 bg-neutral-900 rounded-lg border border-neutral-800">
                  <span className="text-sm font-medium">@{p.username}</span>
                  <span className="text-xs text-neutral-500">{timeSince(p.followedAt)} ago</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Messages */}
        <section>
          <h2 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">
            Recent Messages
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-neutral-600 text-center py-8">No messages sent yet</p>
          ) : (
            <div className="space-y-1">
              {history.slice(0, 30).map((entry, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 px-3 bg-neutral-900 rounded-lg border border-neutral-800">
                  <span className="text-sm font-medium">@{entry.profile.username}</span>
                  <span className="text-xs text-neutral-500">
                    {new Date(entry.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
