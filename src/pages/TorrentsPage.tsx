import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as torrentsApi from "../api/torrents";
import * as downloadsApi from "../api/downloads";
import type { Torrent } from "../types";
import {
  formatBytes,
  torrentStatusColor,
  torrentStatusLabel,
} from "../utils";
import TorrentDetail from "../components/TorrentDetail";
import AddTorrentModal from "../components/AddTorrentModal";

export default function TorrentsPage() {
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchTorrents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await torrentsApi.listTorrents(1, 500);
      setTorrents(data);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTorrents();
  }, [fetchTorrents]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === readyTorrents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(readyTorrents.map((t) => t.id)));
    }
  };

  const readyTorrents = torrents.filter((t) => t.status === "downloaded");

  const handleDownloadSelected = async () => {
    if (selected.size === 0) return;

    const folder = await open({
      directory: true,
      title: "Select download folder",
    });

    if (!folder) return;

    setDownloading(true);
    try {
      for (const torrentId of selected) {
        const torrent = torrents.find((t) => t.id === torrentId);
        if (!torrent) continue;

        const links = await downloadsApi.unrestrictTorrentLinks(torrentId);
        if (links.length > 0) {
          await downloadsApi.startDownloads(
            links,
            folder as string,
            torrent.filename
          );
        }
      }
      setSelected(new Set());
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (readyTorrents.length === 0) return;

    const folder = await open({
      directory: true,
      title: "Select download folder",
    });

    if (!folder) return;

    setDownloading(true);
    try {
      for (const torrent of readyTorrents) {
        const links = await downloadsApi.unrestrictTorrentLinks(torrent.id);
        if (links.length > 0) {
          await downloadsApi.startDownloads(
            links,
            folder as string,
            torrent.filename
          );
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await torrentsApi.deleteTorrent(id);
      setTorrents((prev) => prev.filter((t) => t.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Torrents</h2>
          <p className="text-sm text-zinc-400 mt-1">
            {torrents.length} torrents &middot; {readyTorrents.length} ready
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-rd-green text-black font-semibold rounded-lg hover:bg-green-400 text-sm transition-colors"
          >
            + Add Torrent
          </button>
          <button
            onClick={fetchTorrents}
            className="px-4 py-2 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-300 hover:bg-rd-hover transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Action bar */}
      {readyTorrents.length > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-rd-card border border-rd-border rounded-lg">
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-xs bg-rd-darker border border-rd-border rounded-md text-zinc-300 hover:bg-rd-hover transition-colors"
          >
            {selected.size === readyTorrents.length
              ? "Deselect All"
              : "Select All Ready"}
          </button>
          <button
            onClick={handleDownloadSelected}
            disabled={selected.size === 0 || downloading}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {downloading
              ? "Starting..."
              : `Download Selected (${selected.size})`}
          </button>
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="px-3 py-1.5 text-xs bg-rd-green text-black font-semibold rounded-md hover:bg-green-400 disabled:opacity-40 transition-colors"
          >
            {downloading ? "Starting..." : "Download All Ready"}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Torrent list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-400">Loading torrents...</div>
        </div>
      ) : torrents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-zinc-400 mb-2">No torrents found</p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-rd-green text-sm hover:underline"
          >
            Add your first torrent
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {torrents.map((torrent) => (
            <div
              key={torrent.id}
              className={`flex items-center gap-3 p-4 bg-rd-card border rounded-lg transition-colors cursor-pointer hover:bg-rd-hover ${
                selected.has(torrent.id)
                  ? "border-rd-green"
                  : "border-rd-border"
              }`}
              onClick={() => setDetailId(torrent.id)}
            >
              {/* Checkbox */}
              {torrent.status === "downloaded" && (
                <input
                  type="checkbox"
                  checked={selected.has(torrent.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelect(torrent.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 accent-green-500"
                />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {torrent.filename}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                  <span className={torrentStatusColor(torrent.status)}>
                    {torrentStatusLabel(torrent.status)}
                  </span>
                  <span>{formatBytes(torrent.bytes)}</span>
                  <span>{torrent.links.length} file(s)</span>
                  {torrent.progress > 0 && torrent.progress < 100 && (
                    <span>{torrent.progress}%</span>
                  )}
                </div>
                {/* Progress bar for in-progress torrents */}
                {torrent.progress > 0 && torrent.progress < 100 && (
                  <div className="mt-2 h-1.5 bg-rd-darker rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${torrent.progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(torrent.id);
                }}
                className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {detailId && (
        <TorrentDetail
          torrentId={detailId}
          onClose={() => setDetailId(null)}
          onRefresh={fetchTorrents}
        />
      )}

      {/* Add modal */}
      {showAdd && (
        <AddTorrentModal
          onClose={() => setShowAdd(false)}
          onAdded={fetchTorrents}
        />
      )}
    </div>
  );
}
