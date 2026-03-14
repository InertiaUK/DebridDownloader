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

    const folder = await open({
      directory: true,
      title: "Select download folder",
    });

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-rd-dark border border-rd-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-rd-border flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold truncate">
              {info?.filename ?? "Loading..."}
            </h3>
            {info && (
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                <span className={torrentStatusColor(info.status)}>
                  {torrentStatusLabel(info.status)}
                </span>
                <span>{formatBytes(info.bytes)}</span>
                <span>{info.links.length} link(s)</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-zinc-400 hover:text-zinc-200 text-xl"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-zinc-400">Loading details...</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : info ? (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                <div>
                  <span className="text-zinc-400">Hash:</span>
                  <p className="text-xs text-zinc-300 font-mono truncate">
                    {info.hash}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400">Progress:</span>
                  <p className="text-zinc-200">{info.progress}%</p>
                </div>
                <div>
                  <span className="text-zinc-400">Added:</span>
                  <p className="text-zinc-200">
                    {new Date(info.added).toLocaleString()}
                  </p>
                </div>
                {info.speed != null && info.speed > 0 && (
                  <div>
                    <span className="text-zinc-400">Speed:</span>
                    <p className="text-zinc-200">
                      {formatBytes(info.speed)}/s
                    </p>
                  </div>
                )}
              </div>

              {/* Files */}
              {info.files.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    Files ({info.files.length})
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {info.files.map((file) => (
                      <label
                        key={file.id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-rd-hover cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => toggleFile(file.id)}
                          className="w-3.5 h-3.5 accent-green-500"
                        />
                        <span className="flex-1 text-xs truncate">
                          {file.path}
                        </span>
                        <span className="text-xs text-zinc-400">
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

        {/* Footer actions */}
        {info && (
          <div className="p-4 border-t border-rd-border flex gap-2 justify-end">
            {info.status === "waiting_files_selection" && (
              <button
                onClick={handleSelectFiles}
                disabled={saving || selectedFiles.size === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors"
              >
                {saving ? "Saving..." : "Select Files & Start"}
              </button>
            )}
            {info.status === "downloaded" && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 bg-rd-green text-black text-sm font-semibold rounded-lg hover:bg-green-400 disabled:opacity-40 transition-colors"
              >
                {downloading ? "Starting..." : "Download Files"}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-rd-card border border-rd-border text-sm text-zinc-300 rounded-lg hover:bg-rd-hover transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
