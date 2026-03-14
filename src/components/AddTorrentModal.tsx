import { useState } from "react";
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import * as torrentsApi from "../api/torrents";

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

export default function AddTorrentModal({ onClose, onAdded }: Props) {
  const [magnet, setMagnet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddMagnet = async () => {
    if (!magnet.trim()) {
      setError("Please enter a magnet link");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await torrentsApi.addMagnet(magnet.trim());
      await torrentsApi.selectTorrentFiles(result.id, "all");
      onAdded();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAddFile = async () => {
    const selected = await openFile({
      title: "Select .torrent file",
      filters: [{ name: "Torrent Files", extensions: ["torrent"] }],
    });
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const bytes = await readFile(selected as string);
      const result = await torrentsApi.addTorrentFile(Array.from(bytes));
      await torrentsApi.selectTorrentFiles(result.id, "all");
      onAdded();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="card-base modal-content bg-gradient-to-b from-[#1e1e38] to-[#161628] w-full max-w-lg p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-zinc-100">Add Torrent</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Magnet */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Magnet Link
          </label>
          <textarea
            value={magnet}
            onChange={(e) => setMagnet(e.target.value)}
            placeholder="magnet:?xt=urn:btih:..."
            rows={3}
            className="w-full px-4 py-3 bg-rd-darker border border-rd-border rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-rd-green focus:shadow-[0_0_20px_rgba(120,190,32,0.15)] text-sm resize-none font-mono transition-colors"
          />
          <button
            onClick={handleAddMagnet}
            disabled={loading || !magnet.trim()}
            className="mt-3 w-full py-2.5 bg-rd-green text-black font-semibold rounded-lg hover:bg-green-400 disabled:opacity-30 disabled:cursor-not-allowed text-sm transition-all shadow-lg shadow-rd-green/20 shadow-[0_0_20px_rgba(120,190,32,0.15)]"
          >
            {loading ? "Adding..." : "Add Magnet"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-rd-border" />
          <span className="text-xs text-zinc-600 font-medium">OR</span>
          <div className="flex-1 h-px bg-rd-border" />
        </div>

        {/* File */}
        <button
          onClick={handleAddFile}
          disabled={loading}
          className="w-full py-3 card-base border-dashed rounded-xl text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-30 transition-all"
        >
          <div className="flex flex-col items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload .torrent File
          </div>
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center shadow-[0_0_20px_rgba(239,68,68,0.15)]">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
