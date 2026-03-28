"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/types";

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  dmTemplate: "Hey \u2014 I came across your profile and wanted to say hello.",
  maxDMsPerHour: 10,
  aiTone: "casual",
  sources: { suggested: true, explore: true, friendsOfFriends: true },
};

export default function SettingsForm() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("st_settings");
      if (raw) setSettings(JSON.parse(raw));
    } catch { /* empty */ }
  }, []);

  function save(next: Settings) {
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
    if (!confirm("Reset all ShotTaker data? This clears history, seen profiles, and pending follows.")) return;
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
      {/* AI Tone */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
          Message Tone
        </label>
        <select
          value={settings.aiTone}
          onChange={(e) => save({ ...settings, aiTone: e.target.value as Settings["aiTone"] })}
          className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-white transition appearance-none"
        >
          <option value="casual">Casual</option>
          <option value="flirty">Flirty</option>
          <option value="witty">Witty</option>
          <option value="professional">Professional</option>
        </select>
        <p className="mt-1.5 text-xs text-neutral-500">
          A unique message is generated each time you swipe right.
        </p>
      </div>

      {/* Fallback DM Template */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
          Fallback DM Template
        </label>
        <textarea
          value={settings.dmTemplate}
          onChange={(e) => save({ ...settings, dmTemplate: e.target.value })}
          rows={3}
          className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-white transition"
          placeholder="Used when AI is unavailable..."
        />
      </div>

      {/* Rate Limit */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
          Rate Limit
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={50}
            value={settings.maxDMsPerHour}
            onChange={(e) => save({ ...settings, maxDMsPerHour: parseInt(e.target.value) || 10 })}
            className="w-20 px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white text-sm text-center focus:outline-none focus:border-white transition"
          />
          <span className="text-sm text-neutral-500">max DMs per hour</span>
        </div>
      </div>

      {/* Profile Sources */}
      <div>
        <label className="block text-xs font-medium text-neutral-400 uppercase tracking-wide mb-3">
          Profile Sources
        </label>
        <div className="space-y-3">
          {([
            ["suggested", "Suggested Users"],
            ["explore", "Explore Page"],
            ["friendsOfFriends", "Friends of Friends"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between">
              <span className="text-sm text-white">{label}</span>
              <input
                type="checkbox"
                checked={settings.sources[key]}
                onChange={(e) =>
                  save({ ...settings, sources: { ...settings.sources, [key]: e.target.checked } })
                }
                className="w-5 h-5 rounded bg-neutral-800 border-neutral-600 text-white accent-white"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Save indicator */}
      {saved && (
        <p className="text-sm text-green-400 text-center">Settings saved</p>
      )}

      {/* Actions */}
      <div className="space-y-3 pt-4 border-t border-neutral-800">
        <button
          onClick={handleReset}
          className="w-full py-2.5 text-sm font-medium text-neutral-400 bg-neutral-900 border border-neutral-700 rounded-lg hover:bg-neutral-800 transition"
        >
          Reset All Data
        </button>
        <button
          onClick={handleLogout}
          className="w-full py-2.5 text-sm font-medium text-red-400 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}
