import Roulette from "@/components/Roulette";
import Link from "next/link";

export default function AppPage() {
  return (
    <main className="h-dvh bg-cream-light flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-beige/40">
        <Link href="/" className="text-sm font-bold tracking-tight text-zinc-900">
          shame<span className="text-rose">.ai</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/history" className="text-xs text-zinc-400 hover:text-zinc-900 transition">
            History
          </Link>
          <Link href="/settings" className="text-xs text-zinc-400 hover:text-zinc-900 transition">
            Settings
          </Link>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <Roulette />
      </div>
    </main>
  );
}
