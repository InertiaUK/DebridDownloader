export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(totalBytes: number, downloadedBytes: number, speed: number): string {
  if (speed <= 0) return "--";
  const remaining = totalBytes - downloadedBytes;
  const seconds = remaining / speed;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export function torrentStatusColor(status: string): string {
  switch (status) {
    case "downloaded":
      return "text-green-400";
    case "downloading":
      return "text-blue-400";
    case "queued":
      return "text-yellow-400";
    case "uploading":
    case "compressing":
      return "text-purple-400";
    case "waiting_files_selection":
      return "text-orange-400";
    case "magnet_conversion":
      return "text-cyan-400";
    case "error":
    case "magnet_error":
    case "virus":
    case "dead":
      return "text-red-400";
    default:
      return "text-zinc-400";
  }
}

export function torrentStatusLabel(status: string): string {
  switch (status) {
    case "downloaded":
      return "Ready";
    case "downloading":
      return "Downloading";
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "compressing":
      return "Compressing";
    case "waiting_files_selection":
      return "Select Files";
    case "magnet_conversion":
      return "Converting";
    case "magnet_error":
      return "Magnet Error";
    case "error":
      return "Error";
    case "virus":
      return "Virus Detected";
    case "dead":
      return "Dead";
    default:
      return status;
  }
}

export function getDownloadStatusText(
  status: import("./types").DownloadStatus
): string {
  if (typeof status === "string") return status;
  if ("Failed" in status) return `Failed: ${status.Failed}`;
  return "Unknown";
}
