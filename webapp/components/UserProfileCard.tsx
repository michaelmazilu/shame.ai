"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { IGProfile } from "@/lib/types";

function formatCount(n?: number) {
  if (n == null) return "—";
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export default function UserProfileCard() {
  const [profile, setProfile] = useState<IGProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Get username from auth
        const meRes = await fetch("/api/auth/me");
        const me = await meRes.json();
        if (!me.loggedIn || !me.username) return;

        // Fetch full profile
        const profRes = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: me.username }),
        });
        const data = await profRes.json();
        if (!cancelled && data.profile) setProfile(data.profile);
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-white/60 border border-beige/40 rounded-2xl p-4 animate-pulse flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blush/20 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-blush/20 rounded w-24" />
            <div className="h-3 bg-blush/10 rounded w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="w-full max-w-sm"
    >
      <div className="bg-white/80 backdrop-blur-sm border border-beige/40 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-4">
          {/* Profile pic */}
          {profile.profilePic ? (
            <img
              src={`/api/img-proxy?url=${encodeURIComponent(profile.profilePic)}`}
              alt=""
              className="w-14 h-14 rounded-full object-cover ring-2 ring-rose/30 shrink-0"
              draggable={false}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-blush/30 flex items-center justify-center text-xl font-bold text-rose shrink-0">
              {profile.username[0]?.toUpperCase()}
            </div>
          )}

          {/* Name & username */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-zinc-900 truncate text-sm">
                {profile.fullName || profile.username}
              </p>
              {profile.isVerified && (
                <svg
                  className="w-3.5 h-3.5 text-blue-500 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate">
              @{profile.username}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-around mt-3 pt-3 border-t border-beige/30">
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">
              {formatCount(profile.postCount)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">
              Posts
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">
              {formatCount(profile.followers)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">
              Followers
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-zinc-900">
              {formatCount(profile.following)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">
              Following
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
