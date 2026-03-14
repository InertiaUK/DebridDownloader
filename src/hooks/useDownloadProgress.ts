import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { DownloadProgress } from "../types";

export function useDownloadProgress() {
  const [progress, setProgress] = useState<Map<string, DownloadProgress>>(
    new Map()
  );

  useEffect(() => {
    const unlisten = listen<DownloadProgress>(
      "download-progress",
      (event) => {
        setProgress((prev) => {
          const next = new Map(prev);
          next.set(event.payload.id, event.payload);
          return next;
        });
      }
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return progress;
}
