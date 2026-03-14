import { invoke } from "@tauri-apps/api/core";
import type { AddTorrentResponse, Torrent, TorrentInfo } from "../types";

export async function listTorrents(
  page?: number,
  limit?: number
): Promise<Torrent[]> {
  return invoke("list_torrents", { page: page ?? null, limit: limit ?? null });
}

export async function getTorrentInfo(id: string): Promise<TorrentInfo> {
  return invoke("get_torrent_info", { id });
}

export async function addMagnet(magnet: string): Promise<AddTorrentResponse> {
  return invoke("add_magnet", { magnet });
}

export async function addTorrentFile(
  fileBytes: number[]
): Promise<AddTorrentResponse> {
  return invoke("add_torrent_file", { fileBytes });
}

export async function selectTorrentFiles(
  id: string,
  fileIds: string
): Promise<void> {
  return invoke("select_torrent_files", { id, fileIds });
}

export async function deleteTorrent(id: string): Promise<void> {
  return invoke("delete_torrent", { id });
}
