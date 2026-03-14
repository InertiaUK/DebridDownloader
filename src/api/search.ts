import { invoke } from "@tauri-apps/api/core";
import type { SearchResponse } from "../types";

export async function searchTorrents(
  query: string,
  category?: string,
  sortBy?: string,
  page?: number
): Promise<SearchResponse> {
  return invoke("search_torrents", {
    query,
    category: category ?? null,
    sort_by: sortBy ?? null,
    page: page ?? null,
  });
}
