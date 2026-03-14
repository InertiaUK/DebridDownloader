import { useEffect, useState } from "react";
import * as downloadsApi from "../api/downloads";
import { useDownloadProgress } from "../hooks/useDownloadProgress";
import type { DownloadTask } from "../types";
import {
  formatBytes,
  formatSpeed,
  formatEta,
  getDownloadStatusText,
} from "../utils";

export default function DownloadsPage() {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const progress = useDownloadProgress();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await downloadsApi.getDownloadTasks();
        setTasks(data);
      } catch {
        // ignore
      }
    };
    fetchTasks();
    const interval = setInterval(fetchTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const mergedTasks = tasks.map((task) => {
    const p = progress.get(task.id);
    if (p) {
      return {
        ...task,
        downloaded_bytes: p.downloaded_bytes,
        total_bytes: p.total_bytes,
        speed: p.speed,
        status: p.status,
      };
    }
    return task;
  });

  const activeTasks = mergedTasks.filter(
    (t) =>
      typeof t.status === "string" &&
      (t.status === "Downloading" || t.status === "Pending")
  );
  const completedTasks = mergedTasks.filter(
    (t) => typeof t.status === "string" && t.status === "Completed"
  );
  const failedTasks = mergedTasks.filter(
    (t) =>
      (typeof t.status === "object" && "Failed" in t.status) ||
      (typeof t.status === "string" && t.status === "Cancelled")
  );

  const handleCancel = async (id: string) => {
    try {
      await downloadsApi.cancelDownload(id);
    } catch {
      // ignore
    }
  };

  const handleClearCompleted = async () => {
    try {
      await downloadsApi.clearCompletedDownloads();
      const data = await downloadsApi.getDownloadTasks();
      setTasks(data);
    } catch {
      // ignore
    }
  };

  const totalSpeed = activeTasks.reduce((sum, t) => sum + t.speed, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">Downloads</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full text-xs font-medium">
              {activeTasks.length} active
            </span>
            <span className="bg-green-500/10 text-green-400 px-2.5 py-0.5 rounded-full text-xs font-medium">
              {completedTasks.length} completed
            </span>
            {totalSpeed > 0 && (
              <span className="bg-rd-green/10 text-rd-green px-2.5 py-0.5 rounded-full text-xs font-medium">
                {formatSpeed(totalSpeed)}
              </span>
            )}
          </div>
        </div>
        {(completedTasks.length > 0 || failedTasks.length > 0) && (
          <button
            onClick={handleClearCompleted}
            className="flex items-center gap-2 px-4 py-2 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-all duration-150"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear Finished
          </button>
        )}
      </div>

      {mergedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-rd-card border border-rd-border flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
          </div>
          <p className="text-zinc-300 font-semibold mb-1">Nothing downloading</p>
          <p className="text-zinc-500 text-sm">
            Head to Torrents to queue a download
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active */}
          {activeTasks.length > 0 && (
            <div className="space-y-2">
              {activeTasks.map((task) => {
                const pct =
                  task.total_bytes > 0
                    ? (task.downloaded_bytes / task.total_bytes) * 100
                    : 0;
                return (
                  <div
                    key={task.id}
                    className="p-4 card-base"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-zinc-200 truncate flex-1 mr-4">
                        {task.filename}
                      </p>
                      <button
                        onClick={() => handleCancel(task.id)}
                        className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2.5 bg-black/30 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full progress-bar-blue rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4 text-zinc-500">
                        <span>
                          {formatBytes(task.downloaded_bytes)}{" "}
                          <span className="text-zinc-600">of</span>{" "}
                          {formatBytes(task.total_bytes)}
                        </span>
                        <span className="text-zinc-200 font-medium">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-zinc-500">
                        {task.speed > 0 && (
                          <span className="text-blue-400 font-medium">
                            {formatSpeed(task.speed)}
                          </span>
                        )}
                        {task.speed > 0 && (
                          <span>
                            ETA{" "}
                            {formatEta(
                              task.total_bytes,
                              task.downloaded_bytes,
                              task.speed
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed */}
          {completedTasks.length > 0 && (
            <div className="space-y-2">
              {activeTasks.length > 0 && (
                <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider pt-4 pb-1">
                  Completed
                </p>
              )}
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-4 card-base opacity-80"
                >
                  <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-400 truncate flex-1">
                    {task.filename}
                  </p>
                  <span className="text-xs text-zinc-600">
                    {formatBytes(task.total_bytes)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Failed */}
          {failedTasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider pt-4 pb-1">
                Failed
              </p>
              {failedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-4 card-base shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                >
                  <div className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-400 truncate">
                      {task.filename}
                    </p>
                    <p className="text-xs text-red-400/70 mt-0.5">
                      {getDownloadStatusText(task.status)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
