import Link from "next/link";
import SettingsForm from "@/components/SettingsForm";

export default function SettingsPage() {
  return (
    <main className="min-h-dvh bg-black text-white">
      <header className="flex items-center justify-between px-5 py-3 bg-neutral-950 border-b border-neutral-800">
        <Link href="/" className="text-sm text-neutral-400 hover:text-white transition">
          &larr; Back
        </Link>
        <h1 className="text-sm font-bold tracking-widest uppercase">Settings</h1>
        <div className="w-12" />
      </header>

      <div className="max-w-md mx-auto px-5 py-6">
        <SettingsForm />
      </div>
    </main>
  );
}
