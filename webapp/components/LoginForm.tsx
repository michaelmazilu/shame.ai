"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "credentials" | "2fa" | "checkpoint";

export default function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const [twoFactorInfo, setTwoFactorInfo] = useState<Record<string, string> | null>(null);
  const [checkpointInfo, setCheckpointInfo] = useState<Record<string, string> | null>(null);

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
        setStep("2fa");
        setLoading(false);
        return;
      }

      if (data.checkpointRequired) {
        setCheckpointInfo(data.checkpointInfo);
        setStep("checkpoint");
        setLoading(false);
        return;
      }

      if (!resp.ok || !data.success) {
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

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const is2FA = step === "2fa";
      const endpoint = is2FA ? "/api/auth/verify" : "/api/auth/checkpoint";
      const body = is2FA
        ? {
            code,
            identifier: twoFactorInfo?.identifier,
            username: twoFactorInfo?.username,
            cookies: twoFactorInfo?.cookies,
            csrfToken: twoFactorInfo?.csrfToken,
          }
        : {
            code,
            checkpointUrl: checkpointInfo?.checkpointUrl,
            username: checkpointInfo?.username,
            cookies: checkpointInfo?.cookies,
            csrfToken: checkpointInfo?.csrfToken,
          };

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setError(data.error || "Verification failed");
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

  if (step === "2fa" || step === "checkpoint") {
    return (
      <form onSubmit={handleVerify} className="flex flex-col gap-4 w-full">
        <p className="text-sm text-zinc-500 text-center">
          {step === "2fa"
            ? "Enter the 2FA code from your authenticator app"
            : "Instagram sent a security code to your email"}
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full px-4 py-3 bg-white border border-beige/60 rounded-xl text-zinc-900 text-sm text-center tracking-[0.3em] focus:outline-none focus:border-rose/50 focus:ring-2 focus:ring-rose/10 transition"
        />
        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full py-3.5 bg-zinc-900 text-white font-semibold rounded-xl disabled:opacity-40 transition-colors hover:bg-zinc-800"
        >
          {loading ? "Verifying..." : "Verify"}
        </button>
        <button
          type="button"
          onClick={() => { setStep("credentials"); setCode(""); setError(""); }}
          className="text-sm text-zinc-400 hover:text-zinc-900 transition-colors"
        >
          Back to login
        </button>
        {error && (
          <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-2.5 w-full">
            <p className="text-rose text-sm text-center">{error}</p>
          </div>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4 w-full">
      <input
        type="text"
        autoComplete="username"
        placeholder="Instagram username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-full px-4 py-3 bg-white border border-beige/60 rounded-xl text-zinc-900 text-sm placeholder:text-zinc-300 focus:outline-none focus:border-rose/50 focus:ring-2 focus:ring-rose/10 transition"
      />
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full px-4 py-3 bg-white border border-beige/60 rounded-xl text-zinc-900 text-sm placeholder:text-zinc-300 focus:outline-none focus:border-rose/50 focus:ring-2 focus:ring-rose/10 transition"
      />
      <button
        type="submit"
        disabled={loading || !username.trim() || !password.trim()}
        className="w-full py-3.5 bg-zinc-900 text-white font-semibold rounded-xl disabled:opacity-40 transition-colors hover:bg-zinc-800"
      >
        {loading ? "Logging in..." : "Log in with Instagram"}
      </button>
      {loading && (
        <div className="flex justify-center">
          <div className="w-6 h-6 border-2 border-beige border-t-rose rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-2.5 w-full">
          <p className="text-rose text-sm text-center">{error}</p>
        </div>
      )}
    </form>
  );
}
