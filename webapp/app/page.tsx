"use client";

import Link from "next/link";
import Testimonials from "@/components/Testimonials";
import { RatingInteraction } from "@/components/ui/emoji-rating";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

/* ── Roulette slot machine ── */

const SLOT_ITEMS = [
  "DM a crush",
  "Post a thirst trap",
  "Comment on ex's post",
  "Story camera roll",
  "Send love confession",
  "Go live for 60s",
  "Like 50 posts at 3am",
  "Reply to a story with eyes",
];

function RouletteSlot({ items, speed, finalIndex }: { items: string[]; speed: number; finalIndex: number }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    let count = 0;
    const totalSpins = 12 + finalIndex;
    const interval = setInterval(() => {
      count++;
      setCurrentIndex(count % items.length);
      if (count >= totalSpins) {
        clearInterval(interval);
        setStopped(true);
        setCurrentIndex(finalIndex);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [items.length, speed, finalIndex]);

  return (
    <div className="h-8 overflow-hidden relative">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentIndex}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: stopped ? 0.3 : 0.08 }}
          className="text-sm font-medium text-zinc-700 whitespace-nowrap"
        >
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function MockRoulette() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setKey((k) => k + 1), 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-50 rounded-xl px-5 py-4 max-w-sm mx-auto" key={key}>
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-semibold text-rose/60 tracking-wider w-14 shrink-0">VICTIM</span>
          <div className="flex-1 bg-white rounded-lg border border-zinc-200/60 px-3 py-1.5 overflow-hidden">
            <RouletteSlot items={["Jake", "Sofia", "Marcus", "Aisha", "Devon", "Priya"]} speed={100} finalIndex={3} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-semibold text-pink/60 tracking-wider w-14 shrink-0">RITUAL</span>
          <div className="flex-1 bg-white rounded-lg border border-zinc-200/60 px-3 py-1.5 overflow-hidden">
            <RouletteSlot items={SLOT_ITEMS} speed={80} finalIndex={4} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-semibold text-gold/60 tracking-wider w-14 shrink-0">TARGET</span>
          <div className="flex-1 bg-white rounded-lg border border-zinc-200/60 px-3 py-1.5 overflow-hidden">
            <RouletteSlot items={["@emily_rose", "@jk.photos", "@nkechi_a", "@tomasz.n", "@layla.o"]} speed={120} finalIndex={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mockup UI pieces ── */

function MockDM() {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-[0_8px_30px_-12px_rgba(227,107,138,0.12)] p-4 w-72">
      <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-zinc-100">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink to-rose" />
        <div>
          <p className="text-xs font-semibold text-zinc-900">shame.ai bot</p>
          <p className="text-[10px] text-zinc-400">Active now</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="bg-zinc-50 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">
          <p className="text-xs text-zinc-600">hey I just wanted to say...</p>
        </div>
        <div className="bg-zinc-50 rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%]">
          <p className="text-xs text-zinc-600">I think about you every time I hear that song. you know the one.</p>
        </div>
        <div className="flex justify-end">
          <div className="bg-rose/8 border border-rose/15 rounded-2xl rounded-tr-sm px-3 py-2">
            <p className="text-[10px] text-rose font-medium">Sent by shame.ai</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockComment() {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-[0_8px_30px_-12px_rgba(227,107,138,0.12)] p-4 w-64">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 via-pink to-orange-400" />
        <p className="text-[10px] font-semibold text-zinc-400">Reels</p>
      </div>
      <div className="bg-zinc-900 rounded-xl aspect-[9/10] mb-3 flex items-end p-3">
        <p className="text-[10px] text-white/60">@sarah_vibes cooking tutorial</p>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-beige to-gold shrink-0 mt-0.5" />
        <div>
          <p className="text-xs"><span className="font-semibold text-zinc-900">your_account</span> <span className="text-zinc-500">marry me please this changed my entire life</span></p>
          <p className="text-[10px] text-zinc-400 mt-1">2m</p>
        </div>
      </div>
    </div>
  );
}

function MockStory() {
  return (
    <div className="rounded-2xl border border-zinc-200/80 shadow-[0_8px_30px_-12px_rgba(227,107,138,0.12)] overflow-hidden w-48">
      <div className="bg-gradient-to-br from-rose via-pink to-blush aspect-[9/16] relative flex flex-col items-center justify-center p-4">
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30" />
          <p className="text-[10px] text-white font-semibold drop-shadow-sm">your_account</p>
        </div>
        <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-5 text-center">
          <p className="text-white text-xs font-bold leading-snug">screenshot from your camera roll goes here</p>
        </div>
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <div className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1">
            <p className="text-[9px] text-white/70">Posted by shame.ai</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockNotification() {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-[0_8px_30px_-12px_rgba(227,107,138,0.12)] p-5 w-full">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-100">
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-pink to-rose flex items-center justify-center">
          <span className="text-[8px] text-white font-bold">S</span>
        </div>
        <p className="text-[10px] font-semibold text-zinc-400 tracking-wide">SHAME.AI</p>
        <p className="text-[10px] text-zinc-300 ml-auto">now</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3 bg-zinc-50 rounded-xl px-3 py-2.5">
          <div className="w-6 h-6 rounded-lg bg-rose/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-rose/50">01</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-900">Victim: Jake</p>
            <p className="text-[10px] text-zinc-400">Spin complete</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-zinc-50 rounded-xl px-3 py-2.5">
          <div className="w-6 h-6 rounded-lg bg-pink/10 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-pink/50">02</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-900">Ritual: DM love confession</p>
            <p className="text-[10px] text-zinc-400">Spin complete</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-zinc-50 rounded-xl px-3 py-2.5">
          <div className="w-6 h-6 rounded-lg bg-blush/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-blush">03</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-900">Target: @emily_rose</p>
            <p className="text-[10px] text-zinc-400">Spin complete</p>
          </div>
        </div>
        <div className="bg-zinc-900 rounded-xl px-3 py-2 text-center">
          <p className="text-[10px] text-white font-medium tracking-wide">Executing...</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-cream relative">
      {/* Grain overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "128px 128px" }} />

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-40 backdrop-blur-md bg-cream/80 border-b border-beige/30"
      >
        <div className="flex items-center justify-between px-6 py-3 max-w-5xl mx-auto">
          <Link href="/" className="text-base font-bold tracking-tight text-zinc-900">
            shame<span className="text-rose">.ai</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="#rituals" className="text-xs font-medium text-zinc-900 hover:text-rose transition-colors px-3 py-1.5 rounded-full hover:bg-rose/5">
              Features
            </Link>
            <Link href="/login" className="text-xs font-medium text-zinc-900 hover:text-rose transition-colors px-3 py-1.5 rounded-full hover:bg-rose/5">
              Log in
            </Link>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link href="/login" className="text-xs font-semibold px-4 py-2 bg-rose text-white rounded-full hover:bg-rose-dark transition-colors inline-block ml-1">
                Get started
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-14 pb-16 relative z-10">
        <div className="flex flex-col items-center text-center">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-6xl lg:text-[4.5rem] font-extrabold tracking-tighter text-zinc-900 leading-[1.02] max-w-3xl"
          >
            The AI that{" "}
            <motion.em
              initial={{ opacity: 0, rotate: -3 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.5, type: "spring", stiffness: 150, damping: 12 }}
              className="font-cursive font-normal italic text-rose not-italic"
              style={{ fontStyle: "italic" }}
            >
              humiliates
            </motion.em>{" "}
            your friends
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-4 text-base text-zinc-600 max-w-md leading-relaxed"
          >
            Three spins. One picks the victim, one picks the{" "}
            <span className="font-cursive italic text-rose">ritual</span>,
            one picks the target. All real Instagram actions.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-4"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-rose text-white font-semibold rounded-full hover:bg-rose-dark transition-colors text-sm"
              >
                Start shaming
                <motion.span
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="text-white/70"
                >
                  &rarr;
                </motion.span>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="#rituals"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white border border-zinc-200 text-zinc-700 font-medium rounded-full hover:border-zinc-300 transition-colors text-sm"
              >
                See how it works
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Hero mockup — single centred card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, type: "spring", stiffness: 80, damping: 18 }}
          whileHover={{ y: -4, transition: { type: "spring", stiffness: 300, damping: 20 } }}
          className="mt-10 flex justify-center"
        >
          <div className="w-full max-w-sm">
            <MockNotification />
          </div>
        </motion.div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Features — bento */}
      <section id="rituals" className="py-16 overflow-hidden relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="text-center mb-10 max-w-lg mx-auto"
          >
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tighter text-zinc-900">
              All the ways to{" "}
              <span className="font-cursive italic font-normal text-rose">ruin</span>{" "}
              friendships
            </h2>
            <p className="text-sm text-zinc-600 mt-3 leading-relaxed">
              Every ritual is a real Instagram action. Not hypothetical.
            </p>
          </motion.div>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              whileHover={{ y: -3 }}
              className="md:col-span-4 rounded-[20px] bg-white border border-zinc-200/70 p-[1px] shadow-[0_2px_20px_-6px_rgba(227,107,138,0.08)]"
            >
              <div className="rounded-[19px] bg-gradient-to-b from-cream-light to-white border border-white/80 p-7 flex flex-col sm:flex-row items-center gap-6 overflow-hidden h-full">
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="text-[11px] font-semibold text-rose/60 mb-3 tracking-wider">DM RITUAL</p>
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                    Love <span className="font-cursive italic font-normal">confessions</span>
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    AI writes a heartfelt confession and DMs it to whoever the wheel picks. Unhinged. Real.
                  </p>
                </div>
                <div className="shrink-0 scale-[0.88] origin-center">
                  <MockDM />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              whileHover={{ y: -3 }}
              className="md:col-span-2 rounded-[20px] bg-white border border-zinc-200/70 p-[1px] shadow-[0_2px_20px_-6px_rgba(227,107,138,0.08)]"
            >
              <div className="rounded-[19px] bg-gradient-to-b from-cream-light to-white border border-white/80 p-7 flex flex-col items-center text-center overflow-hidden h-full">
                <p className="text-[11px] font-semibold text-pink/60 mb-3 tracking-wider">STORY RITUAL</p>
                <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                  Story <span className="font-cursive italic font-normal">posts</span>
                </h3>
                <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                  Force embarrassing content onto their story.
                </p>
                <div className="scale-[0.72] origin-center -mb-24">
                  <MockStory />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              whileHover={{ y: -3 }}
              className="md:col-span-3 rounded-[20px] bg-white border border-zinc-200/70 p-[1px] shadow-[0_2px_20px_-6px_rgba(227,107,138,0.08)]"
            >
              <div className="rounded-[19px] bg-gradient-to-b from-cream-light to-white border border-white/80 p-7 flex flex-col sm:flex-row items-center gap-6 overflow-hidden h-full">
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="text-[11px] font-semibold text-gold/60 mb-3 tracking-wider">COMMENT RITUAL</p>
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                    Reel <span className="font-cursive italic font-normal">comments</span>
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Leave unhinged comments on public reels from their account.
                  </p>
                </div>
                <div className="shrink-0 scale-[0.72] origin-center -mb-32 sm:mb-0 sm:-mr-4">
                  <MockComment />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              whileHover={{ y: -3 }}
              className="md:col-span-3 rounded-[20px] bg-white border border-zinc-200/70 p-[1px] shadow-[0_2px_20px_-6px_rgba(227,107,138,0.08)]"
            >
              <div className="rounded-[19px] bg-gradient-to-b from-cream-light to-white border border-white/80 p-7 h-full">
                <div className="text-center mb-5">
                  <p className="text-[11px] font-semibold text-rose/60 mb-3 tracking-wider">CHAOS RITUAL</p>
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                    Ex <span className="font-cursive italic font-normal">interactions</span>
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed max-w-xs mx-auto">
                    Like their photos at 3am. Comment something unhinged. Chaos.
                  </p>
                </div>
                <div className="max-w-xs mx-auto space-y-1.5">
                  <div className="bg-zinc-50 rounded-lg px-3.5 py-2.5 flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-beige to-gold shrink-0" />
                    <p className="text-xs text-zinc-600 flex-1"><span className="font-medium text-zinc-700">your_account</span> liked a photo</p>
                    <p className="text-[10px] text-zinc-300 shrink-0">3:47am</p>
                  </div>
                  <div className="bg-zinc-50 rounded-lg px-3.5 py-2.5 flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-beige to-gold shrink-0" />
                    <p className="text-xs text-zinc-600 flex-1"><span className="font-medium text-zinc-700">your_account</span> commented: &quot;i miss this&quot;</p>
                    <p className="text-[10px] text-zinc-300 shrink-0">3:48am</p>
                  </div>
                  <div className="bg-zinc-50 rounded-lg px-3.5 py-2.5 flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-beige to-gold shrink-0" />
                    <p className="text-xs text-zinc-600 flex-1"><span className="font-medium text-zinc-700">your_account</span> followed <span className="font-medium text-zinc-700">@your_ex</span></p>
                    <p className="text-[10px] text-zinc-300 shrink-0">3:49am</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              whileHover={{ y: -3 }}
              className="md:col-span-6 rounded-[20px] bg-white border border-zinc-200/70 p-[1px] shadow-[0_2px_20px_-6px_rgba(227,107,138,0.08)]"
            >
              <div className="rounded-[19px] bg-gradient-to-b from-cream-light to-white border border-white/80 p-7">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div className="text-center sm:text-left">
                    <p className="text-[11px] font-semibold text-blush mb-3 tracking-wider">RANDOM RITUAL</p>
                    <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                      Camera roll <span className="font-cursive italic font-normal">roulette</span>
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      Grabs a random screenshot and stories it. No preview. Pray it&apos;s not your notes app.
                    </p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-[11px] font-semibold text-pink/60 mb-3 tracking-wider">POST RITUAL</p>
                    <h3 className="text-xl font-bold text-zinc-900 tracking-tight mb-2">
                      Thirst <span className="font-cursive italic font-normal">traps</span>
                    </h3>
                    <p className="text-sm text-zinc-600 leading-relaxed">
                      Questionable selfies. Zero context. AI caption. No review process.
                    </p>
                  </div>
                </div>
                <div className="mt-7">
                  <MockRoulette />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Rating */}
      <section className="py-12 overflow-hidden relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="rounded-[20px] bg-white border border-zinc-200/70 p-[1px] shadow-[0_2px_20px_-6px_rgba(227,107,138,0.08)]"
          >
            <div className="rounded-[19px] bg-gradient-to-b from-cream-light to-white border border-white/80 py-10 px-8 flex flex-col items-center text-center">
              <motion.h3
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
                className="text-2xl sm:text-3xl font-bold tracking-tighter text-pink mb-2"
              >
                How was your <span className="font-cursive italic font-normal text-rose">experience</span>?
              </motion.h3>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                viewport={{ once: true }}
                className="text-sm text-pink/50 mb-5"
              >
                Be honest. We already know.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
                viewport={{ once: true }}
              >
                <RatingInteraction />
              </motion.div>
              <div className="mt-5 h-px w-24 bg-gradient-to-r from-transparent via-blush to-transparent" />
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                viewport={{ once: true }}
                className="mt-4 text-[10px] text-pink/30 font-medium tracking-wider"
              >
                ALL RATINGS COUNT AS 1 STAR
              </motion.p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-zinc-900 overflow-hidden relative z-10">
        <div className="max-w-5xl mx-auto px-6 py-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-white tracking-tighter mb-3"
          >
            Ready to <span className="font-cursive italic font-normal text-rose">destroy</span> some friendships?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            viewport={{ once: true }}
            className="text-sm text-zinc-400 mb-6 max-w-sm mx-auto"
          >
            Connect your Instagram. Add your friends. Let the AI handle the rest.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-rose text-white font-semibold rounded-full hover:bg-rose-dark transition-colors text-sm"
            >
              Get started free
              <motion.span
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="text-white/70"
              >
                &rarr;
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 px-6 py-5 relative z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            shame<span className="text-rose/60">.ai</span>
          </span>
          <span className="text-xs text-zinc-700">
            not affiliated with Instagram
          </span>
        </div>
      </footer>
    </main>
  );
}
