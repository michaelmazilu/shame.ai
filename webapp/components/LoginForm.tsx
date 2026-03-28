"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorInfo, setTwoFactorInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await resp.json();

      if (data.twoFactorRequired) {
        setTwoFactorInfo(data.twoFactorInfo);
        setLoading(false);
        return;
      }

      if (!resp.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("st_username", data.username);
      localStorage.setItem("st_userId", data.userId);
      router.push("/");
    } catch {
      setError("Network error — try again");
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: twoFactorCode,
          identifier: twoFactorInfo?.identifier,
          username: twoFactorInfo?.username,
          cookies: twoFactorInfo?.cookies,
          csrfToken: twoFactorInfo?.csrfToken,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Verification failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("st_username", data.username);
      localStorage.setItem("st_userId", data.userId);
      router.push("/");
    } catch {
      setError("Network error — try again");
      setLoading(false);
    }
  }

  if (twoFactorInfo) {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-center text-neutral-200">
          Two-Factor Authentication
        </h2>
        <p className="text-sm text-neutral-400 text-center">
          Enter the code sent to your phone or authentication app.
        </p>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={twoFactorCode}
          onChange={(e) => setTwoFactorCode(e.target.value)}
          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-center text-lg tracking-widest placeholder:text-neutral-500 focus:outline-none focus:border-white transition"
          maxLength={8}
        />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || !twoFactorCode}
          className="w-full py-3 bg-white text-black font-semibold rounded-lg disabled:opacity-40 transition hover:bg-neutral-200"
        >
          {loading ? "Verifying..." : "Verify"}
        </button>

        <button
          type="button"
          onClick={() => { setTwoFactorInfo(null); setError(""); }}
          className="text-sm text-neutral-400 hover:text-white transition"
        >
          Back to login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full max-w-sm">
      <input
        type="text"
        placeholder="Instagram username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:border-white transition"
      />

      <input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder:text-neutral-500 focus:outline-none focus:border-white transition"
      />

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading || !username || !password}
        className="w-full py-3 bg-white text-black font-semibold rounded-lg disabled:opacity-40 transition hover:bg-neutral-200"
      >
        {loading ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
