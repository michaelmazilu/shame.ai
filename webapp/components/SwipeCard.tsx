"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import type { IGProfile } from "@/lib/types";

const SWIPE_THRESHOLD = 100;

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

interface SwipeCardProps {
  profile: IGProfile;
  onSwipeRight: (profile: IGProfile) => void;
  onSwipeLeft: (profile: IGProfile) => void;
}

export default function SwipeCard({ profile, onSwipeRight, onSwipeLeft }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);

  const posts = profile.recentPosts || [];
  const postImages = posts.filter((p) => p.imageUrl).slice(0, 6);
  const locations = [...new Set(posts.filter((p) => p.location?.name).map((p) => p.location!.name))].slice(0, 2);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const avgLikes = posts.length > 0 ? Math.round(totalLikes / posts.length) : 0;

  const badges: string[] = [];
  if (profile.isVerified) badges.push("Verified");
  if (profile.pronouns?.length) badges.push(profile.pronouns.join("/"));
  if (profile.categoryName) badges.push(profile.categoryName);

  const latestCaption = posts.find((p) => p.caption)?.caption || "";

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    cardRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setDx(e.clientX - startX.current);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      const dir = dx > 0 ? "right" : "left";
      setSwipeDir(dir);
      setSwiping(true);
    } else {
      setDx(0);
    }
  }, [dx]);

  useEffect(() => {
    if (!swiping || !swipeDir) return;
    const timer = setTimeout(() => {
      if (swipeDir === "right") onSwipeRight(profile);
      else onSwipeLeft(profile);
    }, 350);
    return () => clearTimeout(timer);
  }, [swiping, swipeDir, profile, onSwipeRight, onSwipeLeft]);

  const opacity = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
  const rotation = dx * 0.1;

  const transform = swiping
    ? `translateX(${swipeDir === "right" ? 600 : -600}px) rotate(${swipeDir === "right" ? 30 : -30}deg)`
    : `translateX(${dx}px) rotate(${rotation}deg)`;

  const cardOpacity = swiping ? 0 : 1;

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden shadow-xl cursor-grab active:cursor-grabbing touch-none select-none"
      style={{
        transform,
        opacity: cardOpacity,
        transition: swiping || dx === 0 ? "transform 0.35s ease, opacity 0.35s ease" : "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Swipe labels */}
      <div
        className="absolute top-8 right-6 z-10 text-green-400 text-2xl font-bold uppercase tracking-widest rotate-[-12deg] pointer-events-none"
        style={{ opacity: dx > 0 ? opacity : 0, transition: "opacity 0.1s" }}
      >
        Shoot
      </div>
      <div
        className="absolute top-8 left-6 z-10 text-red-400 text-2xl font-bold uppercase tracking-widest rotate-[12deg] pointer-events-none"
        style={{ opacity: dx < 0 ? opacity : 0, transition: "opacity 0.1s" }}
      >
        Pass
      </div>

      {/* Hero image */}
      <div className="relative w-full aspect-[3/4] overflow-hidden">
        {profile.profilePic ? (
          <img
            src={profile.profilePic}
            alt={profile.username}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-500 text-4xl font-bold">
            {profile.username[0]?.toUpperCase()}
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: "40vh" }}>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white leading-tight">
          {profile.fullName || profile.username}
        </h3>
        <p className="text-sm text-neutral-500">@{profile.username}</p>

        {badges.length > 0 && (
          <p className="text-xs text-neutral-400">{badges.join(" \u00B7 ")}</p>
        )}

        {profile.bio && (
          <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-3">
            {truncate(profile.bio, 120)}
          </p>
        )}

        {locations.length > 0 && (
          <p className="text-xs text-neutral-400">
            <span className="font-medium text-neutral-500">Location</span>{" "}
            {locations.join(", ")}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
          {profile.followers != null && <span>{formatCount(profile.followers)} followers</span>}
          {profile.postCount ? <span>{formatCount(profile.postCount)} posts</span> : null}
          {avgLikes > 0 && <span>~{formatCount(avgLikes)} avg likes</span>}
          {(profile.mutualFollowers ?? 0) > 0 && (
            <span className="text-neutral-300 font-medium">
              {profile.mutualFollowers} mutual
              {profile.mutualFollowerNames?.length
                ? ` incl. ${profile.mutualFollowerNames.slice(0, 2).join(", ")}`
                : ""}
            </span>
          )}
        </div>

        {latestCaption && (
          <p className="text-xs text-neutral-400 italic line-clamp-2">
            &ldquo;{truncate(latestCaption, 100)}&rdquo;
          </p>
        )}

        {postImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {postImages.map((p, i) => (
              <img
                key={i}
                src={p.imageUrl!}
                alt="post"
                className="w-14 h-14 rounded-md object-cover"
                draggable={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
