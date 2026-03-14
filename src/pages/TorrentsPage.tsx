import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import MasterDetail from "../components/MasterDetail";
import TorrentDetail from "../components/TorrentDetail";
import { StatsDashboard } from "../components/StatsDashboard";
import AddTorrentModal from "../components/AddTorrentModal";
import { useAuth } from "../hooks/useAuth";
import * as torrentsApi from "../api/torrents";
import * as downloadsApi from "../api/downloads";
import { getSettings } from "../api/settings";
import type { Torrent, DownloadTask, AppSettings } from "../types";
import { formatBytes, torrentStatusColor, torrentStatusLabel } from "../utils";

function statusDotColor(status: string): string {
  switch (status) {
    case "downloaded":
      return "#10b981";
    case "downloading":
      return "#3b82f6";
    case "queued":
    case "waiting_files_selection":
    case "magnet_conversion":
      return "#eab308";
    case "error":
    case "dead":
    case "magnet_error":
      return "#ef4444";
    default:
      return "#94a3b8";
  }
}

export default function TorrentsPage() {
  const { user } = useAuth();
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const completedCountRef = useRef<number>(0);
  const seenCompletedRef = useRef<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    torrentId: string;
  } | null>(null);

  // Force re-render when completedCount changes
  const [, setTick] = useState(0);

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

  // Fetch torrents on mount
  useEffect(() => {
    fetchTorrents();
  }, [fetchTorrents]);

  // Fetch settings on mount
  useEffect(() => {
    getSettings().then(setSettings).catch(() => {});
  }, []);

  // Poll download tasks every 3 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const tasks = await downloadsApi.getDownloadTasks();
        setDownloadTasks(tasks);
        // Check for newly completed
        for (const task of tasks) {
          if (
            task.status === "Completed" &&
            !seenCompletedRef.current.has(task.id)
          ) {
            seenCompletedRef.current.add(task.id);
            completedCountRef.current += 1;
            setTick((t) => t + 1);
          }
        }
      } catch {
        // ignore
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for refresh-list event
  useEffect(() => {
    const handler = () => fetchTorrents();
    window.addEventListener("refresh-list", handler);
    return () => window.removeEventListener("refresh-list", handler);
  }, [fetchTorrents]);

  // Listen for torrent-select event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) setSelectedId(detail.id);
    };
    window.addEventListener("torrent-select", handler);
    return () => window.removeEventListener("torrent-select", handler);
  }, []);

  // Listen for deselect-item event
  useEffect(() => {
    const handler = () => setSelectedId(null);
    window.addEventListener("deselect-item", handler);
    return () => window.removeEventListener("deselect-item", handler);
  }, []);

  // Listen for delete-selected event
  useEffect(() => {
    const handler = () => {
      if (selectedId && window.confirm("Delete this torrent?")) {
        handleDelete(selectedId);
      }
    };
    window.addEventListener("delete-selected", handler);
    return () => window.removeEventListener("delete-selected", handler);
  }, [selectedId]);

  // Listen for action-selected event (download)
  useEffect(() => {
    const handler = () => {
      if (selectedId) {
        handleDownloadTorrent(selectedId);
      }
    };
    window.addEventListener("action-selected", handler);
    return () => window.removeEventListener("action-selected", handler);
  }, [selectedId, settings]);

  // Close context menu on click outside or Esc
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const handleDelete = async (id: string) => {
    try {
      await torrentsApi.deleteTorrent(id);
      setTorrents((prev) => prev.filter((t) => t.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleDownloadTorrent = async (id: string) => {
    const torrent = torrents.find((t) => t.id === id);
    if (!torrent) return;
    try {
      let folder = settings?.download_folder ?? null;
      if (!folder) {
        const picked = await open({ directory: true, title: "Select download folder" });
        if (!picked) return;
        folder = picked as string;
      }
      const links = await downloadsApi.unrestrictTorrentLinks(id);
      if (links.length > 0) {
        await downloadsApi.startDownloads(links, folder, torrent.filename);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const listPanel = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-[rgba(255,255,255,0.04)]">
        <span className="text-[14px] font-semibold text-[#f1f5f9] tracking-[-0.2px]">
          Torrents
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAdd(true)}
            className="bg-[#10b981] hover:bg-[#34d399] text-white rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors"
          >
            + Add
          </button>
          <button
            onClick={fetchTorrents}
            className="text-[#475569] hover:text-[#94a3b8] hover:bg-[rgba(255,255,255,0.04)] rounded-md p-1.5 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-[12px] text-[#ef4444] bg-[rgba(239,68,68,0.06)]">
          {error}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-[rgba(16,185,129,0.3)] border-t-[#10b981] rounded-full animate-spin" />
          </div>
        ) : torrents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-[#475569] text-[13px]">No torrents yet</p>
            <p className="text-[#374151] text-[12px] mt-1">
              Add a magnet link or torrent file to get started
            </p>
          </div>
        ) : (
          torrents.map((torrent) => {
            const isSelected = selectedId === torrent.id;
            const dotColor = statusDotColor(torrent.status);
            const showProgress =
              torrent.status === "downloading" &&
              torrent.progress > 0 &&
              torrent.progress < 100;

            return (
              <div
                key={torrent.id}
                className={`flex items-center gap-3 px-4 cursor-pointer transition-colors duration-150 ${
                  isSelected
                    ? "border-l-2 border-[#10b981] bg-[rgba(16,185,129,0.04)]"
                    : "border-l-2 border-transparent hover:bg-[rgba(255,255,255,0.03)]"
                }`}
                style={{ minHeight: "44px" }}
                onClick={() => setSelectedId(torrent.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    torrentId: torrent.id,
                  });
                }}
              >
                {/* Status dot */}
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: dotColor }}
                />

                {/* Filename */}
                <div className="flex-1 min-w-0 py-2">
                  <div className="text-[13px] font-medium text-[#f1f5f9] truncate">
                    {torrent.filename}
                  </div>
                  {showProgress && (
                    <div className="mt-1 h-0.5 rounded-full bg-[rgba(59,130,246,0.08)]">
                      <div
                        className="h-0.5 bg-[#3b82f6] rounded-full transition-all duration-500"
                        style={{ width: `${torrent.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Right side info */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[#475569]">
                    {formatBytes(torrent.bytes)}
                  </span>
                  <span
                    className={`text-[11px] ${torrentStatusColor(torrent.status)}`}
                  >
                    {torrentStatusLabel(torrent.status)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const detailPanel = selectedId ? (
    <TorrentDetail torrentId={selectedId} onRefresh={fetchTorrents} />
  ) : (
    <StatsDashboard
      user={user}
      downloadTasks={downloadTasks}
      settings={settings}
      completedCount={completedCountRef.current}
    />
  );

  return (
    <>
      <MasterDetail listPanel={listPanel} detailPanel={detailPanel} />

      {showAdd && (
        <AddTorrentModal
          onClose={() => setShowAdd(false)}
          onAdded={fetchTorrents}
        />
      )}

      {contextMenu && (
        <div
          className="fixed bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-lg py-1 w-44 z-50 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-2 text-[13px] text-[#f1f5f9] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            onClick={() => {
              const id = contextMenu.torrentId;
              setContextMenu(null);
              handleDownloadTorrent(id);
            }}
          >
            Download
          </button>
          <button
            className="w-full text-left px-3 py-2 text-[13px] text-[#ef4444] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            onClick={() => {
              const id = contextMenu.torrentId;
              setContextMenu(null);
              if (window.confirm("Delete this torrent?")) {
                handleDelete(id);
              }
            }}
          >
            Delete
          </button>
          <button
            className="w-full text-left px-3 py-2 text-[13px] text-[#f1f5f9] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            onClick={() => {
              const torrent = torrents.find(
                (t) => t.id === contextMenu.torrentId
              );
              setContextMenu(null);
              if (torrent) {
                navigator.clipboard.writeText(
                  "magnet:?xt=urn:btih:" + torrent.hash
                );
              }
            }}
          >
            Copy Magnet
          </button>
        </div>
      )}
    </>
  );
}
