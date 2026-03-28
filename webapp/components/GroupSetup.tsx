"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { IGProfile } from "@/lib/types";

interface GroupSetupProps {
  onReady: (members: IGProfile[]) => void;
}

export default function GroupSetup({ onReady }: GroupSetupProps) {
  const [members, setMembers] = useState<IGProfile[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    const username = input.trim().replace(/^@/, "");
    if (!username) return;
    if (members.find((m) => m.username.toLowerCase() === username.toLowerCase())) {
      setError("Already in the group");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const resp = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (resp.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await resp.json();
      if (!data.profile) {
        setError(`@${username} not found`);
        setLoading(false);
        return;
      }

      setMembers((prev) => [...prev, data.profile]);
      setInput("");
    } catch {
      setError("Failed to look up user");
    } finally {
      setLoading(false);
    }
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="flex-1 flex flex-col items-center px-5 py-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
          Build your group
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Add friends by Instagram username. Only they can be victims.
        </p>
      </motion.div>

      <form onSubmit={addMember} className="w-full max-w-md flex gap-2 mb-6">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 text-sm pointer-events-none">@</span>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(""); }}
            placeholder="username"
            disabled={loading}
            className="w-full pl-8 pr-4 py-3 bg-white border border-beige/60 rounded-xl text-zinc-900 text-sm placeholder:text-zinc-300 focus:outline-none focus:border-rose/50 focus:ring-2 focus:ring-rose/10 transition disabled:opacity-50"
          />
        </div>
        <motion.button
          type="submit"
          disabled={loading || !input.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-5 py-3 bg-zinc-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors hover:bg-zinc-800 shrink-0"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
          ) : (
            "Add"
          )}
        </motion.button>
      </form>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-rose text-sm mb-4"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md space-y-2 mb-8">
        <AnimatePresence>
          {members.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: 20, height: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className="bg-white border border-beige/60 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              {member.profilePic ? (
                <img
                  src={member.profilePic}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-blush/40"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blush to-rose/30 flex items-center justify-center text-sm font-bold text-rose ring-2 ring-blush/40">
                  {member.username[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-zinc-900 text-sm truncate">@{member.username}</p>
                {member.fullName && (
                  <p className="text-xs text-zinc-400 truncate">{member.fullName}</p>
                )}
              </div>
              <button
                onClick={() => removeMember(member.id)}
                className="text-zinc-300 hover:text-rose transition-colors text-lg leading-none px-1"
              >
                &times;
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {members.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-10"
          >
            <p className="text-4xl mb-3">👻</p>
            <p className="text-sm text-zinc-300">No one in the group yet</p>
          </motion.div>
        )}
      </div>

      <div className="w-full max-w-md">
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: "0 0 50px rgba(227,107,138,0.3)" }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onReady(members)}
          disabled={members.length < 2}
          className="w-full py-4 text-lg font-bold bg-gradient-to-r from-pink to-rose text-white rounded-2xl shadow-[0_0_30px_rgba(227,107,138,0.2)] transition-shadow disabled:opacity-30 disabled:shadow-none"
        >
          {members.length < 2
            ? `Add at least ${2 - members.length} more ${members.length === 1 ? "person" : "people"}`
            : `Start with ${members.length} victims`}
        </motion.button>
      </div>
    </div>
  );
}
