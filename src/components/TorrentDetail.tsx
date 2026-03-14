import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as torrentsApi from "../api/torrents";
import * as downloadsApi from "../api/downloads";
import type { TorrentInfo } from "../types";
import {
  formatBytes,
  torrentStatusColor,
  torrentStatusLabel,
} from "../utils";

interface Props {
  torrentId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function TorrentDetail({ torrentId, onClose, onRefresh }: Props) {
  const [info, setInfo] = useState<TorrentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        setLoading(true);
        const data = await torrentsApi.getTorrentInfo(torrentId);
        setInfo(data);
        setSelectedFiles(
          new Set(data.files.filter((f) => f.selected === 1).map((f) => f.id))
        );
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [torrentId]);

  const handleSelectFiles = async () => {
    if (!info) return;
    setSaving(true);
    try {
      const ids = Array.from(selectedFiles).join(",");
      await torrentsApi.selectTorrentFiles(info.id, ids || "all");
      onRefresh();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!info) return;
    const folder = await open({ directory: true, title: "Select download folder" });
    if (!folder) return;
    setDownloading(true);
    try {
      const links = await downloadsApi.unrestrictTorrentLinks(info.id);
      if (links.length > 0) {
        await downloadsApi.startDownloads(links, folder as string, info.filename);
      }
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  };

  const toggleFile = (id: number) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="card-base modal-content bg-gradient-to-b from-[#1e1e38] to-[#161628] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-rd-border flex items-start justify-between">
          <div className="min-w-0 flex-1 mr-4">
            <h3 className="text-lg font-bold text-zinc-100 truncate">
              {info?.filename ?? "Loading..."}
            </h3>
            {info && (
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${torrentStatusColor(info.status)}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      info.status === "downloaded" ? "bg-green-400" : "bg-current"
                    }`}
                  />
                  {torrentStatusLabel(info.status)}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatBytes(info.bytes)}
                </span>
                <span className="text-xs text-zinc-600">
                  {info.links.length} link(s)
                </span>
              </div>
            )}
          </div>
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-rd-green/30 border-t-rd-green rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : info ? (
            <>
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-gradient-to-b from-white/[0.03] to-transparent border border-[rgba(255,255,255,0.06)] rounded-lg">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Hash</p>
                  <p className="text-xs text-zinc-300 font-mono truncate">{info.hash}</p>
                </div>
                <div className="p-3 bg-gradient-to-b from-white/[0.03] to-transparent border border-[rgba(255,255,255,0.06)] rounded-lg">
                  <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Added</p>
                  <p className="text-xs text-zinc-300">{new Date(info.added).toLocaleString()}</p>
                </div>
                {info.progress < 100 && (
                  <div className="p-3 bg-gradient-to-b from-white/[0.03] to-transparent border border-[rgba(255,255,255,0.06)] rounded-lg">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Progress</p>
                    <p className="text-xs text-zinc-300">{info.progress}%</p>
                  </div>
                )}
                {info.speed != null && info.speed > 0 && (
                  <div className="p-3 bg-gradient-to-b from-white/[0.03] to-transparent border border-[rgba(255,255,255,0.06)] rounded-lg">
                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-1">Speed</p>
                    <p className="text-xs text-blue-400">{formatBytes(info.speed)}/s</p>
                  </div>
                )}
              </div>

              {/* Files */}
              {info.files.length > 0 && (
                <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">
                    Files ({info.files.length})
                  </p>
                  <div className="space-y-1 max-h-60 overflow-y-auto rounded-lg border border-[rgba(255,255,255,0.06)]">
                    {info.files.map((file) => (
                      <label
                        key={file.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => toggleFile(file.id)}
                        />
                        <span className="flex-1 text-xs text-zinc-300 truncate">
                          {file.path.startsWith("/") ? file.path.slice(1) : file.path}
                        </span>
                        <span className="text-xs text-zinc-600 shrink-0">
                          {formatBytes(file.bytes)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {info && (
          <div className="px-6 py-4 border-t border-rd-border flex gap-2 justify-end bg-gradient-to-b from-[#1a1a30] to-[#141428]">
            {info.status === "waiting_files_selection" && (
              <button
                onClick={handleSelectFiles}
                disabled={saving || selectedFiles.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-all"
              >
                {saving ? "Saving..." : "Select Files & Start"}
              </button>
            )}
            {info.status === "downloaded" && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-2 px-4 py-2 bg-rd-green text-black text-sm font-semibold rounded-lg hover:bg-green-400 disabled:opacity-40 transition-all shadow-lg shadow-rd-green/20 shadow-[0_0_20px_rgba(120,190,32,0.15)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {downloading ? "Starting..." : "Download Files"}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-rd-card border border-rd-border text-sm text-zinc-400 rounded-lg hover:text-zinc-200 hover:border-zinc-500 transition-all"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
