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

  // Poll tasks periodically
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

  // Merge live progress events with polled tasks
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Downloads</h2>
          <p className="text-sm text-zinc-400 mt-1">
            {activeTasks.length} active &middot; {completedTasks.length}{" "}
            completed
            {totalSpeed > 0 && ` \u00b7 ${formatSpeed(totalSpeed)}`}
          </p>
        </div>
        {(completedTasks.length > 0 || failedTasks.length > 0) && (
          <button
            onClick={handleClearCompleted}
            className="px-4 py-2 bg-rd-card border border-rd-border rounded-lg text-sm text-zinc-300 hover:bg-rd-hover transition-colors"
          >
            Clear Finished
          </button>
        )}
      </div>

      {mergedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-zinc-400 mb-1">No active downloads</p>
          <p className="text-zinc-500 text-sm">
            Go to Torrents to start downloading
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Active first, then completed, then failed */}
          {[...activeTasks, ...completedTasks, ...failedTasks].map((task) => {
            const pct =
              task.total_bytes > 0
                ? (task.downloaded_bytes / task.total_bytes) * 100
                : 0;
            const statusText = getDownloadStatusText(task.status);
            const isActive =
              typeof task.status === "string" &&
              (task.status === "Downloading" || task.status === "Pending");
            const isCompleted =
              typeof task.status === "string" && task.status === "Completed";
            const isFailed =
              typeof task.status === "object" && "Failed" in task.status;

            return (
              <div
                key={task.id}
                className="p-4 bg-rd-card border border-rd-border rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium truncate flex-1">
                    {task.filename}
                  </p>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span
                      className={`text-xs ${
                        isCompleted
                          ? "text-green-400"
                          : isFailed
                            ? "text-red-400"
                            : "text-blue-400"
                      }`}
                    >
                      {statusText}
                    </span>
                    {isActive && (
                      <button
                        onClick={() => handleCancel(task.id)}
                        className="px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/30 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-rd-darker rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCompleted
                        ? "bg-green-500"
                        : isFailed
                          ? "bg-red-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span>
                    {formatBytes(task.downloaded_bytes)} /{" "}
                    {formatBytes(task.total_bytes)}
                  </span>
                  <span>{pct.toFixed(1)}%</span>
                  {isActive && task.speed > 0 && (
                    <>
                      <span>{formatSpeed(task.speed)}</span>
                      <span>
                        ETA:{" "}
                        {formatEta(
                          task.total_bytes,
                          task.downloaded_bytes,
                          task.speed
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
