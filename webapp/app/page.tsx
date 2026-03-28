import CardStack from "@/components/CardStack";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="h-dvh bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-neutral-950 border-b border-neutral-800">
        <h1 className="text-sm font-bold tracking-widest uppercase text-white">
          ShotTaker
        </h1>
        <div className="flex items-center gap-4">
          <Link href="/history" className="text-xs text-neutral-400 hover:text-white transition">
            History
          </Link>
          <Link href="/settings" className="text-xs text-neutral-400 hover:text-white transition">
            Settings
          </Link>
        </div>
      </header>

      {/* Card stack fills remaining space */}
      <div className="flex-1 relative">
        <CardStack />
      </div>
    </main>
  );
}
