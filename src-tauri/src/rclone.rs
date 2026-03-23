use serde::Serialize;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct RcloneInfo {
    pub version: String,
    pub available: bool,
}

/// Check if rclone is installed and return version info
pub async fn check_rclone() -> Option<RcloneInfo> {
    let output = Command::new("rclone")
        .arg("version")
        .output()
        .await
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // First line is like "rclone v1.68.0"
    let version = stdout
        .lines()
        .next()
        .unwrap_or("rclone (unknown version)")
        .to_string();

    Some(RcloneInfo {
        version,
        available: true,
    })
}

/// List configured rclone remotes
pub async fn list_remotes() -> Result<Vec<String>, String> {
    let output = Command::new("rclone")
        .arg("listremotes")
        .output()
        .await
        .map_err(|e| format!("Failed to run rclone: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("rclone listremotes failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let remotes: Vec<String> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.to_string())
        .collect();

    Ok(remotes)
}

/// Detect if a path is an rclone remote (matches `name:` or `name:path`)
pub fn is_rclone_path(path: &str) -> bool {
    // Pattern: alphanumeric/hyphen/underscore followed by colon
    // Must not match Windows drive letters like C:\
    if let Some(colon_pos) = path.find(':') {
        if colon_pos == 0 {
            return false;
        }
        // Windows drive letter: single char + colon + backslash
        if colon_pos == 1 && path.len() > 2 && path.as_bytes()[2] == b'\\' {
            return false;
        }
        let name = &path[..colon_pos];
        name.chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    } else {
        false
    }
}
