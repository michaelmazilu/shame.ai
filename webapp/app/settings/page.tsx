import Link from "next/link";
import SettingsForm from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <main className="min-h-dvh bg-cream-light text-zinc-900">
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-beige/40">
        <Link href="/app" className="text-sm text-zinc-400 hover:text-zinc-900 transition">
          &larr; Back
        </Link>
        <h1 className="text-sm font-bold tracking-tight">
          shame<span className="text-rose">.ai</span> <span className="text-zinc-400 font-normal">/ settings</span>
        </h1>
        <div className="w-12" />
      </header>

      <div className="max-w-md mx-auto px-5 py-6">
        <SettingsForm />
      </div>
    </main>
  );
}
