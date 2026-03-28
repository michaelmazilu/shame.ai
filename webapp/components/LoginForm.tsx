"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBrowserLogin() {
    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/auth/browser", {
        method: "POST",
      });

      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      localStorage.setItem("st_username", data.username || "");
      localStorage.setItem("st_userId", data.userId);
      router.push("/app");
    } catch {
      setError("Connection lost — try again");
      setLoading(false);
    }
  }

<<<<<<< Updated upstream
  return (
    <div className="flex flex-col gap-6 w-full max-w-sm items-center">
      <button
        onClick={handleBrowserLogin}
        disabled={loading}
        className="w-full py-3.5 bg-white text-black font-semibold rounded-lg disabled:opacity-40 transition hover:bg-neutral-200"
      >
        {loading ? "Waiting for login..." : "Log in with Instagram"}
      </button>

      {loading && (
        <div className="text-center space-y-2">
          <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-sm text-neutral-400">
            A browser window should open on your computer.
          </p>
          <p className="text-sm text-neutral-500">
            Log in to Instagram there, then come back here.
          </p>
        </div>
      )}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
=======
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
      router.push("/app");
    } catch {
      setError("Network error — try again");
      setLoading(false);
    }
  }

  if (twoFactorInfo) {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4 w-full">
        <div className="bg-blush/30 border border-blush rounded-xl px-4 py-3 mb-1">
          <p className="text-sm font-medium text-zinc-700">Two-factor authentication</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Enter the code sent to your phone or auth app.
          </p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={twoFactorCode}
          onChange={(e) => setTwoFactorCode(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-beige rounded-xl text-zinc-900 text-center text-lg tracking-widest placeholder:text-zinc-300 focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose/20 transition"
          maxLength={8}
        />

        {error && (
          <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-2.5">
            <p className="text-rose text-sm text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !twoFactorCode}
          className="w-full py-3 bg-zinc-900 text-white font-semibold rounded-xl disabled:opacity-40 transition-colors hover:bg-zinc-800"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Verifying
            </span>
          ) : (
            "Verify"
          )}
        </button>

        <button
          type="button"
          onClick={() => { setTwoFactorInfo(null); setError(""); }}
          className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors"
        >
          &larr; Back to login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-3.5 w-full">
      <div>
        <label htmlFor="username" className="block text-xs font-medium text-zinc-500 mb-1.5">
          Instagram username
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-beige rounded-xl text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose/20 transition"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs font-medium text-zinc-500 mb-1.5">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-beige rounded-xl text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:border-rose focus:ring-1 focus:ring-rose/20 transition"
        />
      </div>

      {error && (
        <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-2.5">
          <p className="text-rose text-sm text-center">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !username || !password}
        className="w-full py-3 mt-1 bg-zinc-900 text-white font-semibold rounded-xl disabled:opacity-40 transition-colors hover:bg-zinc-800"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Logging in
          </span>
        ) : (
          "Log in"
        )}
      </button>
    </form>
>>>>>>> Stashed changes
  );
}
