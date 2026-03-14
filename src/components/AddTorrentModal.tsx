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
      // Auto-select all files
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-rd-dark border border-rd-border rounded-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">Add Torrent</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Magnet link */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-300 mb-2">
            Magnet Link
          </label>
          <textarea
            value={magnet}
            onChange={(e) => setMagnet(e.target.value)}
            placeholder="magnet:?xt=urn:btih:..."
            rows={3}
            className="w-full px-4 py-3 bg-rd-darker border border-rd-border rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-rd-green text-sm resize-none font-mono"
          />
          <button
            onClick={handleAddMagnet}
            disabled={loading || !magnet.trim()}
            className="mt-2 w-full py-2.5 bg-rd-green text-black font-semibold rounded-lg hover:bg-green-400 disabled:opacity-40 text-sm transition-colors"
          >
            {loading ? "Adding..." : "Add Magnet"}
          </button>
        </div>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-rd-border" />
          <span className="text-xs text-zinc-500">OR</span>
          <div className="flex-1 h-px bg-rd-border" />
        </div>

        {/* Torrent file */}
        <button
          onClick={handleAddFile}
          disabled={loading}
          className="w-full py-3 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-300 hover:bg-rd-hover disabled:opacity-40 transition-colors"
        >
          Upload .torrent File
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
