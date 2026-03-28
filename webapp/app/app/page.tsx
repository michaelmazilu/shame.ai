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
        <div className="flex items-center gap-2">
          <Link href="/history" className="text-xs font-semibold text-rose bg-rose/10 hover:bg-rose/20 transition-colors px-4 py-1.5 rounded-full">History</Link>
          <Link href="/settings" className="text-xs font-semibold text-rose bg-rose/10 hover:bg-rose/20 transition-colors px-4 py-1.5 rounded-full">Settings</Link>
          <Link href="/room" className="text-xs font-semibold text-white bg-rose hover:bg-rose-dark transition-colors px-4 py-1.5 rounded-full">Room</Link>
        </div>
      </motion.header>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Roulette />
      </div>
    </main>
  );
}
