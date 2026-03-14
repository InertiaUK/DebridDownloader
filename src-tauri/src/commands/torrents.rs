use crate::api::types::{AddTorrentResponse, Torrent, TorrentInfo};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub async fn list_torrents(
    state: State<'_, AppState>,
    page: Option<u32>,
    limit: Option<u32>,
) -> Result<Vec<Torrent>, String> {
    state
        .client
        .list_torrents(page, limit)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn get_torrent_info(
    state: State<'_, AppState>,
    id: String,
) -> Result<TorrentInfo, String> {
    state
        .client
        .torrent_info(&id)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn add_magnet(
    state: State<'_, AppState>,
    magnet: String,
) -> Result<AddTorrentResponse, String> {
    state
        .client
        .add_magnet(&magnet)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn add_torrent_file(
    state: State<'_, AppState>,
    file_bytes: Vec<u8>,
) -> Result<AddTorrentResponse, String> {
    state
        .client
        .add_torrent_file(file_bytes)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn select_torrent_files(
    state: State<'_, AppState>,
    id: String,
    file_ids: String,
) -> Result<(), String> {
    state
        .client
        .select_files(&id, &file_ids)
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn delete_torrent(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state
        .client
        .delete_torrent(&id)
        .await
        .map_err(|e| format!("{}", e))
}
