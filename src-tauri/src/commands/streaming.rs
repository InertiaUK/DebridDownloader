use crate::state::{AppState, StreamSession};
use std::time::Instant;
use tauri::State;
use uuid::Uuid;

#[tauri::command]
pub async fn get_stream_url(
    state: State<'_, AppState>,
    torrent_id: String,
    file_id: u64,
) -> Result<serde_json::Value, String> {
    let port = state
        .streaming_port
        .read()
        .await
        .ok_or("Streaming server not running")?;

    // Verify torrent is ready for streaming
    let provider = state.get_provider().await;
    let info = provider
        .torrent_info(&torrent_id)
        .await
        .map_err(|e| format!("Failed to fetch torrent info: {}", e))?;
    if info.status != "downloaded" {
        return Err("Torrent is not ready for streaming.".to_string());
    }

    let link = provider
        .get_download_link_for_file(&torrent_id, file_id)
        .await
        .map_err(|e| format!("Failed to get download link: {}", e))?;

    let session_id = Uuid::new_v4().to_string();
    let session = StreamSession {
        url: link.download,
        created_at: Instant::now(),
    };

    state
        .stream_sessions
        .write()
        .await
        .insert(session_id.clone(), session);

    let stream_url = format!("http://127.0.0.1:{}/stream/{}", port, session_id);

    Ok(serde_json::json!({
        "stream_url": stream_url,
        "session_id": session_id
    }))
}

#[tauri::command]
pub async fn cleanup_stream_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.stream_sessions.write().await.remove(&session_id);
    Ok(())
}
