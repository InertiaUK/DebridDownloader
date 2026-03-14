import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as settingsApi from "../api/settings";
import type { AppSettings } from "../types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsApi.getSettings();
        setSettings(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    try {
      await settingsApi.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePickFolder = async () => {
    const folder = await open({
      directory: true,
      title: "Select default download folder",
    });
    if (folder && settings) {
      setSettings({ ...settings, download_folder: folder as string });
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Settings</h2>
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="max-w-lg space-y-6">
        {/* Download folder */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Default Download Folder
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={settings.download_folder ?? "Not set"}
              className="flex-1 px-4 py-2.5 bg-rd-darker border border-rd-border rounded-lg text-sm text-zinc-300"
            />
            <button
              onClick={handlePickFolder}
              className="px-4 py-2.5 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-300 hover:bg-rd-hover transition-colors"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Concurrent downloads */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Max Concurrent Downloads
          </label>
          <select
            value={settings.max_concurrent_downloads}
            onChange={(e) =>
              setSettings({
                ...settings,
                max_concurrent_downloads: Number(e.target.value),
              })
            }
            className="w-full px-4 py-2.5 bg-rd-darker border border-rd-border rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-rd-green"
          >
            {[1, 2, 3, 4, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* Torrent subfolders */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.create_torrent_subfolders}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  create_torrent_subfolders: e.target.checked,
                })
              }
              className="w-4 h-4 accent-green-500"
            />
            <div>
              <p className="text-sm font-medium text-zinc-300">
                Create subfolders per torrent
              </p>
              <p className="text-xs text-zinc-500">
                Organize downloaded files into folders named after each torrent
              </p>
            </div>
          </label>
        </div>

        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Theme
          </label>
          <select
            value={settings.theme}
            onChange={(e) =>
              setSettings({ ...settings, theme: e.target.value })
            }
            className="w-full px-4 py-2.5 bg-rd-darker border border-rd-border rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-rd-green"
          >
            <option value="dark">Dark</option>
            <option value="light">Light (coming soon)</option>
          </select>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-rd-green text-black font-semibold rounded-lg hover:bg-green-400 text-sm transition-colors"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
