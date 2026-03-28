"use client";

import Roulette from "@/components/roulette/Roulette";
import Link from "next/link";
import { motion } from "motion/react";

export default function AppPage() {
  return (
    <main className="h-dvh bg-cream flex flex-col overflow-hidden relative">
      {/* Ambient glows on cream */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-rose/10 rounded-full blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[250px] h-[250px] bg-pink/8 rounded-full blur-[80px]" />
      <div className="pointer-events-none absolute top-1/2 left-0 w-[200px] h-[200px] bg-blush/10 rounded-full blur-[80px]" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between px-5 py-2 bg-cream/80 backdrop-blur-md border-b border-beige/30 sticky top-0 z-20 relative"
      >
        <Link href="/" className="text-sm font-bold tracking-tight text-zinc-900">
          shame<span className="text-rose">.ai</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/history" className="text-[11px] font-medium text-zinc-400 hover:text-zinc-900 transition-colors px-2.5 py-1 rounded-full hover:bg-rose/5">History</Link>
          <Link href="/settings" className="text-[11px] font-medium text-zinc-400 hover:text-zinc-900 transition-colors px-2.5 py-1 rounded-full hover:bg-rose/5">Settings</Link>
          <Link href="/room" className="text-[11px] font-medium text-zinc-400 hover:text-zinc-900 transition-colors px-2.5 py-1 rounded-full hover:bg-rose/5">Room</Link>
        </div>
      </motion.header>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Roulette />
      </div>
    </main>
  );
}
