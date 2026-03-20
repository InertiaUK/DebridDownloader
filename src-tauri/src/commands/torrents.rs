use crate::providers::types::{AddTorrentResponse, Torrent, TorrentInfo};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_torrents(
    state: State<'_, AppState>,
    page: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<Torrent>, String> {
    let provider = state.get_provider().await;
    provider
        .list_torrents(page.unwrap_or(1), limit.unwrap_or(100))
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn get_torrent_info(
    state: State<'_, AppState>,
    id: String,
) -> Result<TorrentInfo, String> {
    let provider = state.get_provider().await;
    provider
        .torrent_info(&id)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn add_magnet(
    state: State<'_, AppState>,
    magnet: String,
) -> Result<AddTorrentResponse, String> {
    let provider = state.get_provider().await;
    provider
        .add_magnet(&magnet)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn add_torrent_file(
    state: State<'_, AppState>,
    file_bytes: Vec<u8>,
) -> Result<AddTorrentResponse, String> {
    let provider = state.get_provider().await;
    provider
        .add_torrent_file(&file_bytes)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn select_torrent_files(
    state: State<'_, AppState>,
    id: String,
    file_ids: String,
) -> Result<(), String> {
    let ids: Vec<u64> = if file_ids == "all" {
        vec![]
    } else {
        file_ids
            .split(',')
            .filter_map(|s| s.trim().parse().ok())
            .collect()
    };
    let provider = state.get_provider().await;
    provider
        .select_files(&id, &ids)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn delete_torrent(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let provider = state.get_provider().await;
    provider
        .delete_torrent(&id)
        .await
        .map_err(|e| format!("{}", e))
}
