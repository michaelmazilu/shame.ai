import Roulette from "@/components/Roulette";
import Link from "next/link";

export default function AppPage() {
  return (
    <main className="h-dvh bg-cream flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 bg-white/80 backdrop-blur-sm border-b border-beige/40 sticky top-0 z-10">
        <Link href="/" className="text-sm font-bold tracking-tight text-zinc-900">
          shame<span className="text-rose">.ai</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/history" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 transition-colors">
            History
          </Link>
          <Link href="/settings" className="text-xs font-medium text-zinc-400 hover:text-zinc-900 transition-colors">
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
