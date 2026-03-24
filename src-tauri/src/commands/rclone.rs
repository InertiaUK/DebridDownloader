use crate::rclone;

#[tauri::command]
pub async fn check_rclone() -> Option<rclone::RcloneInfo> {
    rclone::check_rclone().await
}

#[tauri::command]
pub async fn list_rclone_remotes() -> Result<Vec<String>, String> {
    rclone::list_remotes().await
}

#[tauri::command]
pub async fn validate_rclone_remote(remote_name: String) -> Result<bool, String> {
    let remotes = rclone::list_remotes().await?;
    // remote_name might be "gdrive:" or "gdrive" — normalize
    let normalized = if remote_name.ends_with(':') {
        remote_name.clone()
    } else {
        format!("{}:", remote_name)
    };
    Ok(remotes.iter().any(|r| r == &normalized))
}
