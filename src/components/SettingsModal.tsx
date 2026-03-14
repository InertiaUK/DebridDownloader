import { useState, useEffect, useRef } from "react";
import { getSettings, updateSettings } from "../api/settings";
import type { AppSettings } from "../types";
import { open } from "@tauri-apps/plugin-dialog";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedField, setSavedField] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSettings()
      .then((s) => setSettings(s))
      .finally(() => setLoading(false));
  }, []);

  function markSaved(field: string) {
    setSavedField(field);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSavedField(null), 1500);
  }

  async function applyChange(patch: Partial<AppSettings>) {
    if (!settings) return;
    const next: AppSettings = { ...settings, ...patch };
    setSettings(next);
    await updateSettings(next);
  }

  async function handleBrowse() {
    const selected = await open({ directory: true, title: "Select download folder" });
    if (selected && typeof selected === "string") {
      await applyChange({ download_folder: selected });
      markSaved("download_folder");
    }
  }

  async function handleConcurrentChange(value: number) {
    await applyChange({ max_concurrent_downloads: value });
    markSaved("max_concurrent_downloads");
  }

  async function handleSubfoldersChange(value: boolean) {
    await applyChange({ create_torrent_subfolders: value });
    markSaved("create_torrent_subfolders");
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[440px] bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-xl p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title row */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[14px] font-semibold text-[#f1f5f9] tracking-[-0.2px]">
            Settings
          </span>
          <button
            onClick={onClose}
            className="text-[#475569] hover:text-[#f1f5f9] transition-colors leading-none"
            aria-label="Close settings"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-[13px] text-[#475569]">Loading…</span>
          </div>
        ) : settings ? (
          <>
            {/* Section 1: Download Folder */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[#475569] uppercase tracking-wider">
                  Download Folder
                </span>
                {savedField === "download_folder" && (
                  <span className="text-[#10b981] text-[11px]">✓</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-[#08080f] rounded-md p-2.5 text-[13px] truncate flex-1">
                  {settings.download_folder ? (
                    <span className="text-[#94a3b8]">{settings.download_folder}</span>
                  ) : (
                    <span className="text-[#374151]">Not set</span>
                  )}
                </div>
                <button
                  onClick={handleBrowse}
                  className="bg-[rgba(255,255,255,0.04)] text-[#94a3b8] hover:text-[#f1f5f9] rounded-md px-3 py-2 text-[12px] transition-colors shrink-0"
                >
                  Browse
                </button>
              </div>
            </div>

            {/* Section 2: Concurrent Downloads */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[#475569] uppercase tracking-wider">
                  Max Concurrent Downloads
                </span>
                {savedField === "max_concurrent_downloads" && (
                  <span className="text-[#10b981] text-[11px]">✓</span>
                )}
              </div>
              <select
                value={settings.max_concurrent_downloads}
                onChange={(e) => handleConcurrentChange(Number(e.target.value))}
                className="w-full bg-[#08080f] border border-[rgba(255,255,255,0.06)] rounded-md p-2.5 text-[13px] text-[#f1f5f9] focus:outline-none focus:border-[rgba(16,185,129,0.3)]"
              >
                {[1, 2, 3, 4, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} simultaneous download{n !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Section 3: Subfolders */}
            <div className="mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.create_torrent_subfolders}
                  onChange={(e) => handleSubfoldersChange(e.target.checked)}
                  className="mt-0.5 shrink-0 accent-[#10b981]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#f1f5f9]">
                      Create subfolders per torrent
                    </span>
                    {savedField === "create_torrent_subfolders" && (
                      <span className="text-[#10b981] text-[11px]">✓</span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#475569] mt-0.5">
                    Organize downloads into folders named after each torrent
                  </p>
                </div>
              </label>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-32">
            <span className="text-[13px] text-[#475569]">Failed to load settings.</span>
          </div>
        )}
      </div>
    </div>
  );
}
