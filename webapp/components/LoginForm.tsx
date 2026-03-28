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

  return (
    <div className="flex flex-col gap-6 w-full items-center">
      <button
        onClick={handleBrowserLogin}
        disabled={loading}
        className="w-full py-3.5 bg-zinc-900 text-white font-semibold rounded-xl disabled:opacity-40 transition-colors hover:bg-zinc-800"
      >
        {loading ? "Waiting for login..." : "Log in with Instagram"}
      </button>

      {loading && (
        <div className="text-center space-y-2">
          <div className="w-6 h-6 border-2 border-beige border-t-rose rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500">
            A browser window should open on your computer.
          </p>
          <p className="text-sm text-zinc-400">
            Log in to Instagram there, then come back here.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-rose/10 border border-rose/20 rounded-xl px-4 py-2.5 w-full">
          <p className="text-rose text-sm text-center">{error}</p>
        </div>
      )}
    </div>
  );
}
