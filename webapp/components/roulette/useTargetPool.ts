"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { IGProfile } from "@/lib/types";

const POOL_SIZE = 50;
const REFILL_THRESHOLD = 20;
const STORAGE_KEY = "st_target_pool";
const SEEN_KEY = "st_target_seen";
const CURSOR_KEY = "st_target_cursor";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export interface TargetPool {
  targets: IGProfile[];
  loading: boolean;
  error: string;
  markUsed: (id: string) => void;
  clearPool: () => void;
}

export function useTargetPool(): TargetPool {
  const [targets, setTargets] = useState<IGProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const seenRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const usedCountRef = useRef(0);

  const fetchBatch = useCallback(async (isInitial: boolean) => {
    if (fetchingRef.current || !hasMoreRef.current) return;
    fetchingRef.current = true;
    if (isInitial) setLoading(true);

    try {
      const resp = await fetch("/api/following", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: POOL_SIZE,
          exclude: Array.from(seenRef.current),
          maxId: cursorRef.current,
        }),
      });

      if (resp.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await resp.json();
      if (!data.profiles?.length && isInitial) {
        setError("No accounts found in your following list");
        return;
      }

      const newProfiles: IGProfile[] = data.profiles || [];
      cursorRef.current = data.nextMaxId || null;
      hasMoreRef.current = !!data.hasMore;

      for (const p of newProfiles) seenRef.current.add(p.id);

      setTargets((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const unique = newProfiles.filter((p) => !existingIds.has(p.id));
        const merged = [...prev, ...shuffle(unique)];
        saveJson(STORAGE_KEY, merged);
        saveJson(SEEN_KEY, Array.from(seenRef.current));
        saveJson(CURSOR_KEY, cursorRef.current);
        return merged;
      });
    } catch {
      if (isInitial) setError("Failed to load targets");
    } finally {
      fetchingRef.current = false;
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = loadJson<IGProfile[]>(STORAGE_KEY, []);
    const cachedSeen = loadJson<string[]>(SEEN_KEY, []);
    const cachedCursor = loadJson<string | null>(CURSOR_KEY, null);

    seenRef.current = new Set(cachedSeen);
    cursorRef.current = cachedCursor;

    if (cached.length >= 10) {
      setTargets(cached);
      setLoading(false);
    } else {
      fetchBatch(true);
    }
  }, [fetchBatch]);

  const markUsed = useCallback((id: string) => {
    usedCountRef.current++;

    setTargets((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      saveJson(STORAGE_KEY, filtered);
      return filtered;
    });

    if (usedCountRef.current >= REFILL_THRESHOLD) {
      usedCountRef.current = 0;
      fetchBatch(false);
    }
  }, [fetchBatch]);

  const clearPool = useCallback(() => {
    setTargets([]);
    seenRef.current.clear();
    cursorRef.current = null;
    hasMoreRef.current = true;
    usedCountRef.current = 0;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SEEN_KEY);
    localStorage.removeItem(CURSOR_KEY);
    fetchBatch(true);
  }, [fetchBatch]);

  return { targets, loading, error, markUsed, clearPool };
}
