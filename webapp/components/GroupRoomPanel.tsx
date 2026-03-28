"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MultiplayerLobby from "@/components/MultiplayerLobby";

/**
 * Group path on /app: same create/join room flow as /room (Supabase multiplayer).
 */
export default function GroupRoomPanel() {
  const [username, setUsername] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
        });
        const data = (await res.json()) as {
          loggedIn?: boolean;
          username?: string | null;
        };
        if (!cancelled) {
          const fromApi = data.username?.trim() || null;
          const fromLs =
            typeof window !== "undefined"
              ? localStorage.getItem("st_username")?.trim() || null
              : null;
          // Only treat as signed in when iron-session says so (avoid fake lobby without cookies)
          setUsername(data.loggedIn ? fromApi || fromLs : null);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setUsername(null);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!username) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center space-y-4">
        <p className="text-zinc-600 text-sm max-w-sm">
          Log in with Instagram to create or join a group room with a code.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center py-3 px-8 rounded-full bg-rose text-white text-sm font-semibold"
        >
          Log in with Instagram
        </Link>
        <Link href="/" className="text-xs text-zinc-400 hover:text-rose">
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <MultiplayerLobby igUsername={username} />
    </div>
  );
}
