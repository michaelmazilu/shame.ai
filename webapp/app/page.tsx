"use client";

import Link from "next/link";
import Testimonials from "@/components/Testimonials";
import { RatingInteraction } from "@/components/ui/emoji-rating";
import { motion } from "motion/react";

const RITUALS = [
  "Post an embarrassing reel to your story",
  "Comment heart eyes on a random reel",
  "DM a love confession to someone",
  "Post a thirst trap with zero context",
  "Comment 'I miss you' on an ex's post",
  "Story a screenshot of your camera roll",
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-cream">
      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto"
      >
        <span className="text-lg font-bold tracking-tight text-zinc-900">
          shame<span className="text-rose">.ai</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Log in
          </Link>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/login"
              className="text-sm font-semibold px-5 py-2.5 bg-rose text-white rounded-full hover:bg-rose-dark transition-colors inline-block"
            >
              Get started
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left */}
          <div className="lg:col-span-7">
            <motion.p
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-sm font-semibold text-rose tracking-wide uppercase mb-4"
            >
              For friend groups with no boundaries
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-zinc-900 leading-[1.05]"
            >
              The AI that<br />
              humiliates your<br />
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.6, type: "spring", stiffness: 200, damping: 15 }}
                className="text-rose inline-block"
              >
                friends for you
              </motion.span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-6 text-lg text-zinc-500 max-w-lg leading-relaxed"
            >
              Three roulette spins. One picks the victim. One picks the
              ritual. One picks the target. All connected to Instagram.
              No mercy.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-8 flex items-center gap-4"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-7 py-3.5 bg-pink text-white font-semibold rounded-full hover:bg-rose transition-colors text-sm"
                >
                  Start shaming
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    aria-hidden="true"
                  >
                    &rarr;
                  </motion.span>
                </Link>
              </motion.div>
              <span className="text-xs text-zinc-400">Free. No cap. Literally.</span>
            </motion.div>
          </div>

          {/* Right — ritual preview card */}
          <motion.div
            initial={{ opacity: 0, y: 50, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, delay: 0.4, type: "spring", stiffness: 100, damping: 20 }}
            className="lg:col-span-5 lg:mt-8"
          >
            <motion.div
              whileHover={{ y: -4, boxShadow: "0 20px 40px -12px rgba(227, 107, 138, 0.2)" }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-cream-light border border-blush/60 rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-4">
                <motion.div
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-rose"
                />
                <span className="text-xs font-medium text-gold uppercase tracking-wider">
                  Live ritual feed
                </span>
              </div>
              <ul className="space-y-3">
                {RITUALS.map((r, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-start gap-3 text-sm text-zinc-600 leading-snug"
                  >
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-blush flex items-center justify-center text-[10px] font-bold text-rose shrink-0">
                      {i + 1}
                    </span>
                    {r}
                  </motion.li>
                ))}
              </ul>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                className="mt-5 pt-4 border-t border-beige/40 flex items-center justify-between"
              >
                <span className="text-xs text-zinc-400">and many more...</span>
                <span className="text-xs font-medium text-rose">AI-generated</span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Features strip */}
      <section className="bg-cream py-24 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              className="lg:col-span-5"
            >
              <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">
                Current rituals
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
                All the ways to<br />ruin friendships
              </h2>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Every ritual is an actual Instagram action. Not hypothetical.
                Not a screenshot. Real posts, real DMs, real comments.
                Connected to your actual account.
              </p>
            </motion.div>

            <div className="lg:col-span-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "Story posts", detail: "Force embarrassing content onto their story" },
                  { label: "Reel comments", detail: "Leave unhinged comments on public reels" },
                  { label: "Love confessions", detail: "DM heartfelt (fake) confessions to people" },
                  { label: "Thirst traps", detail: "Post questionable content with zero context" },
                  { label: "Ex interactions", detail: "Comment on an ex's post. Chaos guaranteed." },
                  { label: "Camera roll roulette", detail: "Story a random screenshot. Pray." },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    viewport={{ once: true }}
                    whileHover={{ y: -3, borderColor: "rgba(240, 141, 160, 0.5)" }}
                    className="bg-cream-light border border-beige rounded-xl px-5 py-4 transition-shadow hover:shadow-md"
                  >
                    <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                    <p className="text-xs text-zinc-400 mt-1">{item.detail}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rating */}
      <section className="bg-cream py-16 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center gap-4"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
            How was your experience?
          </p>
          <RatingInteraction />
        </motion.div>
      </section>

      {/* CTA */}
      <section className="bg-zinc-900 border-t border-zinc-800 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3"
          >
            Ready to destroy some friendships?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            viewport={{ once: true }}
            className="text-sm text-zinc-400 mb-8 max-w-md mx-auto"
          >
            Connect your Instagram. Add your friends. Let the AI do the rest.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-rose text-white font-semibold rounded-full hover:bg-rose-dark transition-colors text-sm"
            >
              Get started free
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden="true"
              >
                &rarr;
              </motion.span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="bg-zinc-950 px-6 py-8"
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            shame<span className="text-rose">.ai</span> &mdash; made with questionable intentions
          </span>
          <span className="text-xs text-zinc-600">
            not affiliated with Instagram (obviously)
          </span>
        </div>
      </motion.footer>
    </main>
  );
}
