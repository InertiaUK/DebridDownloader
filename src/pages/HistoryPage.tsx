import { useEffect, useState } from "react";
import * as downloadsApi from "../api/downloads";
import type { DownloadItem } from "../types";
import { formatBytes } from "../utils";

export default function HistoryPage() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await downloadsApi.getDownloadHistory(page, 50);
        setItems(data);
        setError("");
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [page]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Download History</h2>
          <p className="text-sm text-zinc-400 mt-1">
            Past unrestricted links from Real-Debrid
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 text-sm bg-rd-card border border-rd-border rounded-lg text-zinc-300 hover:bg-rd-hover disabled:opacity-40 transition-colors"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-zinc-400">
            Page {page}
          </span>
          <button
            disabled={items.length < 50}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm bg-rd-card border border-rd-border rounded-lg text-zinc-300 hover:bg-rd-hover disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-400">Loading history...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-zinc-400">No download history</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-4 bg-rd-card border border-rd-border rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.filename}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                  <span>{formatBytes(item.filesize)}</span>
                  <span>{item.host}</span>
                  <span>
                    {new Date(item.generated).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
