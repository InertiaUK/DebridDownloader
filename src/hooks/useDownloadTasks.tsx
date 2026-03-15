import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import * as downloadsApi from "../api/downloads";
import type { DownloadTask, DownloadProgress } from "../types";

interface DownloadTasksContextValue {
  tasks: DownloadTask[];
  refreshTasks: () => Promise<void>;
}

const DownloadTasksContext = createContext<DownloadTasksContextValue>({
  tasks: [],
  refreshTasks: async () => {},
});

export function DownloadTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [progress, setProgress] = useState<Map<string, DownloadProgress>>(new Map());

  // Listen for real-time progress events
  useEffect(() => {
    const unlisten = listen<DownloadProgress>("download-progress", (event) => {
      setProgress((prev) => {
        const next = new Map(prev);
        next.set(event.payload.id, event.payload);
        return next;
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Poll for task list every 3 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await downloadsApi.getDownloadTasks();
        setTasks(data);
      } catch {
        // ignore
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for refresh-list events
  useEffect(() => {
    const handler = async () => {
      try {
        const data = await downloadsApi.getDownloadTasks();
        setTasks(data);
      } catch {
        // ignore
      }
    };
    window.addEventListener("refresh-list", handler);
    return () => window.removeEventListener("refresh-list", handler);
  }, []);

  const refreshTasks = async () => {
    try {
      const data = await downloadsApi.getDownloadTasks();
      setTasks(data);
    } catch {
      // ignore
    }
  };

  // Merge real-time progress into tasks
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

  return (
    <DownloadTasksContext.Provider value={{ tasks: mergedTasks, refreshTasks }}>
      {children}
    </DownloadTasksContext.Provider>
  );
}

export function useDownloadTasks() {
  return useContext(DownloadTasksContext);
}
