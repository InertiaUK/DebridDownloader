import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import * as torrentsApi from "../api/torrents";
import * as downloadsApi from "../api/downloads";
import { getSettings } from "../api/settings";
import type { TorrentInfo } from "../types";
import { formatBytes } from "../utils";

interface Props {
  torrentId: string;
  onRefresh: () => void;
}

function statusBadge(status: string) {
  switch (status) {
    case "downloaded":
      return "bg-[rgba(16,185,129,0.12)] text-[#10b981]";
    case "downloading":
      return "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]";
    case "waiting_files_selection":
    case "queued":
    case "magnet_conversion":
      return "bg-[rgba(234,179,8,0.12)] text-[#eab308]";
    case "error":
    case "dead":
    case "magnet_error":
      return "bg-[rgba(239,68,68,0.12)] text-[#ef4444]";
    default:
      return "bg-[rgba(148,163,184,0.12)] text-[#94a3b8]";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "downloaded":
      return "Ready";
    case "downloading":
      return "Downloading";
    case "waiting_files_selection":
      return "Select Files";
    case "queued":
      return "Queued";
    case "magnet_conversion":
      return "Converting";
    case "error":
      return "Error";
    case "dead":
      return "Dead";
    case "magnet_error":
      return "Magnet Error";
    default:
      return status;
  }
}

export default function TorrentDetail({ torrentId, onRefresh }: Props) {
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
        setError("");
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
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!info) return;
    setDownloading(true);
    try {
      const settings = await getSettings();
      let folder = settings.download_folder;
      if (!folder) {
        const picked = await open({ directory: true, title: "Select download folder" });
        if (!picked) {
          setDownloading(false);
          return;
        }
        folder = picked as string;
      }
      const links = await downloadsApi.unrestrictTorrentLinks(info.id);
      if (links.length > 0) {
        await downloadsApi.startDownloads(links, folder, info.filename);
      }
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!info) return;
    if (!window.confirm("Delete this torrent?")) return;
    try {
      await torrentsApi.deleteTorrent(info.id);
      onRefresh();
      window.dispatchEvent(new CustomEvent("deselect-item"));
    } catch (e) {
      setError(String(e));
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-[rgba(16,185,129,0.3)] border-t-[#10b981] rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="p-6">
        <p className="text-[#ef4444] text-[13px]">{error}</p>
      </div>
    );
  }

  if (!info) return null;

  return (
    <div className="p-6">
      {/* Filename + status badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-[#f1f5f9] tracking-[-0.2px] min-w-0 break-words">
          {info.filename}
        </h3>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusBadge(info.status)}`}
        >
          {statusLabel(info.status)}
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <p className="text-[#ef4444] text-[13px] mt-2">{error}</p>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="bg-[#0f0f18] rounded-md p-3">
          <div className="text-[11px] text-[#475569] uppercase tracking-wider">Hash</div>
          <div className="text-[13px] text-[#f1f5f9] font-mono truncate mt-0.5">{info.hash}</div>
        </div>
        <div className="bg-[#0f0f18] rounded-md p-3">
          <div className="text-[11px] text-[#475569] uppercase tracking-wider">Size</div>
          <div className="text-[13px] text-[#f1f5f9] mt-0.5">{formatBytes(info.bytes)}</div>
        </div>
        <div className="bg-[#0f0f18] rounded-md p-3">
          <div className="text-[11px] text-[#475569] uppercase tracking-wider">Added</div>
          <div className="text-[13px] text-[#f1f5f9] mt-0.5">{new Date(info.added).toLocaleString()}</div>
        </div>
        <div className="bg-[#0f0f18] rounded-md p-3">
          <div className="text-[11px] text-[#475569] uppercase tracking-wider">Links</div>
          <div className="text-[13px] text-[#f1f5f9] mt-0.5">{info.links.length}</div>
        </div>
        {info.progress < 100 && (
          <div className="bg-[#0f0f18] rounded-md p-3">
            <div className="text-[11px] text-[#475569] uppercase tracking-wider">Progress</div>
            <div className="text-[13px] text-[#f1f5f9] mt-0.5">{info.progress}%</div>
          </div>
        )}
        {info.speed != null && info.speed > 0 && (
          <div className="bg-[#0f0f18] rounded-md p-3">
            <div className="text-[11px] text-[#475569] uppercase tracking-wider">Speed</div>
            <div className="text-[13px] text-[#3b82f6] mt-0.5">{formatBytes(info.speed)}/s</div>
          </div>
        )}
      </div>

      {/* File list */}
      {info.files.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] text-[#475569] uppercase tracking-wider mb-2">
            Files ({info.files.length})
          </div>
          <div className="max-h-60 overflow-y-auto rounded-md border border-[rgba(255,255,255,0.04)]">
            {info.files.map((file) => (
              <label
                key={file.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-[rgba(255,255,255,0.02)] cursor-pointer border-b border-[rgba(255,255,255,0.04)] last:border-b-0 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.has(file.id)}
                  onChange={() => toggleFile(file.id)}
                  className="accent-[#10b981]"
                />
                <span className="flex-1 text-[13px] text-[#f1f5f9] truncate min-w-0">
                  {file.path.startsWith("/") ? file.path.slice(1) : file.path}
                </span>
                <span className="text-[11px] text-[#475569] shrink-0">
                  {formatBytes(file.bytes)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        {info.status === "waiting_files_selection" && (
          <button
            onClick={handleSelectFiles}
            disabled={saving || selectedFiles.size === 0}
            className="bg-[#3b82f6] hover:bg-blue-500 text-white rounded-md px-4 py-2 text-[13px] font-medium disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving..." : "Select Files & Start"}
          </button>
        )}
        {info.status === "downloaded" && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-[#10b981] hover:bg-[#34d399] text-white rounded-md px-4 py-2 text-[13px] font-medium disabled:opacity-40 transition-colors"
          >
            {downloading ? "Starting..." : "Download"}
          </button>
        )}
        <button
          onClick={handleDelete}
          className="text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] rounded-md px-4 py-2 text-[13px] transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
