"use client";

import LoginForm from "@/components/LoginForm";
import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((data) => {
        if (data.loggedIn) {
          localStorage.setItem("st_username", data.username || "");
          localStorage.setItem("st_userId", data.userId || "");
          router.replace("/app");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-dvh bg-cream flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-blush border-t-rose rounded-full" />
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-cream flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-5/12 bg-zinc-900 flex-col justify-between p-10 relative overflow-hidden">
        {/* Floating blobs */}
        <motion.div
          animate={{ y: [0, -20, 0], x: [0, 10, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 right-10 w-40 h-40 bg-rose/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 15, 0], x: [0, -10, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-32 left-6 w-32 h-32 bg-pink/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, -10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 4 }}
          className="absolute top-1/2 left-1/2 w-24 h-24 bg-blush/8 rounded-full blur-2xl"
        />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="text-lg font-bold text-white tracking-tight relative z-10">
            shame<span className="text-rose">.ai</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
        >
          <h2 className="text-3xl font-bold text-white tracking-tight leading-snug mb-3">
            Connect your Instagram.<br />
            Add your friends.<br />
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-rose inline-block"
            >
              Let chaos begin.
            </motion.span>
          </h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-sm text-zinc-400 leading-relaxed max-w-sm"
          >
            Three roulette wheels decide who gets humiliated, how, and
            who receives the DM. All real Instagram actions. No mercy.
          </motion.p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-xs text-zinc-600 relative z-10"
        >
          not affiliated with Instagram (obviously)
        </motion.p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 15 }}
            className="lg:hidden mb-10 text-center"
          >
            <Link href="/" className="text-lg font-bold text-zinc-900 tracking-tight">
              shame<span className="text-rose">.ai</span>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Log in with your Instagram account to start
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <LoginForm />
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-8 text-center text-xs text-zinc-400"
          >
            Your credentials are encrypted and never stored in plain text.
          </motion.p>
        </motion.div>
      </div>
    </main>
  );
}
