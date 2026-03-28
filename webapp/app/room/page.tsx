import Link from "next/link";
import { getIGSession } from "@/lib/session";
import MultiplayerLobby from "@/components/MultiplayerLobby";

export default async function RoomPage() {
  const ig = await getIGSession();
  if (!ig?.username) {
    return (
      <main className="min-h-dvh bg-cream flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
              Group <span className="text-rose">room</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-3 leading-relaxed">
              Log in with Instagram on shame.ai first. Punishments are meant to
              run as your IG account (DM, follow, etc.) — the lobby only works
              when you&apos;re signed in here.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full py-3 rounded-full bg-rose text-white text-sm font-semibold"
          >
            Log in with Instagram
          </Link>
          <p className="text-xs text-zinc-400">
            <Link href="/" className="text-rose">
              ← Home
            </Link>
            {" · "}
            <Link href="/app" className="text-zinc-500">
              Solo roulette
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-cream">
      <MultiplayerLobby igUsername={ig.username} />
    </main>
  );
}
