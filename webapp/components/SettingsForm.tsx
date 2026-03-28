"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ShameSettings {
  maxDMsPerHour: number;
  sources: { suggested: boolean; explore: boolean; friendsOfFriends: boolean };
}

const DEFAULT_SETTINGS: ShameSettings = {
  maxDMsPerHour: 10,
  sources: { suggested: true, explore: true, friendsOfFriends: true },
};

export default function SettingsForm() {
  const router = useRouter();
  const [settings, setSettings] = useState<ShameSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("st_settings");
      if (raw) setSettings(JSON.parse(raw));
    } catch { /* empty */ }
  }, []);

  function save(next: ShameSettings) {
    setSettings(next);
    localStorage.setItem("st_settings", JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleLogout() {
    document.cookie = "shottaker_session=; Max-Age=0; path=/";
    localStorage.removeItem("st_username");
    localStorage.removeItem("st_userId");
    router.push("/login");
  }

  function handleReset() {
    if (!confirm("Reset all Shame data? This clears history and seen profiles.")) return;
    localStorage.removeItem("st_seen");
    localStorage.removeItem("st_shot_history");
    localStorage.removeItem("st_dms_hour");
    localStorage.removeItem("st_dms_reset");
    localStorage.removeItem("st_pending_follows");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Rate Limit
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={50}
            value={settings.maxDMsPerHour}
            onChange={(e) => save({ ...settings, maxDMsPerHour: parseInt(e.target.value) || 10 })}
            className="w-20 px-3 py-2 bg-white border border-beige/60 rounded-lg text-zinc-900 text-sm text-center focus:outline-none focus:border-rose transition"
          />
          <span className="text-sm text-zinc-400">max shames per hour</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
          Victim Sources
        </label>
        <div className="space-y-3">
          {([
            ["suggested", "Suggested Users"],
            ["explore", "Explore Page"],
            ["friendsOfFriends", "Friends of Friends"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between">
              <span className="text-sm text-zinc-900">{label}</span>
              <input
                type="checkbox"
                checked={settings.sources[key]}
                onChange={(e) =>
                  save({ ...settings, sources: { ...settings.sources, [key]: e.target.checked } })
                }
                className="w-5 h-5 rounded bg-white border-beige text-rose accent-rose"
              />
            </label>
          ))}
        </div>
      </div>

      {saved && (
        <p className="text-sm text-green-600 text-center">Saved</p>
      )}

      <div className="space-y-3 pt-4 border-t border-beige/40">
        <button
          onClick={handleReset}
          className="w-full py-2.5 text-sm font-medium text-zinc-500 bg-white border border-beige/60 rounded-lg hover:border-zinc-300 transition"
        >
          Reset All Data
        </button>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 text-sm font-medium text-rose bg-white border border-beige/60 rounded-lg hover:border-rose/40 transition"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
