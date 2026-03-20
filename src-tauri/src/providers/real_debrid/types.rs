use serde::{Deserialize, Serialize};

// These are Real-Debrid-specific API response shapes.
// They get mapped to shared provider types in the DebridProvider impl.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdUser {
    pub id: u64,
    pub username: String,
    pub email: String,
    pub points: u64,
    pub locale: String,
    pub avatar: String,
    #[serde(rename = "type")]
    pub account_type: String,
    pub premium: u64,
    pub expiration: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdTorrent {
    pub id: String,
    pub filename: String,
    #[serde(default)]
    pub hash: String,
    pub bytes: i64,
    pub host: String,
    pub split: i64,
    pub progress: f64,
    pub status: String,
    pub added: String,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub ended: Option<String>,
    #[serde(default)]
    pub speed: Option<i64>,
    #[serde(default)]
    pub seeders: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdTorrentFile {
    pub id: u64,
    pub path: String,
    pub bytes: i64,
    pub selected: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdTorrentInfo {
    pub id: String,
    pub filename: String,
    #[serde(default)]
    pub original_filename: Option<String>,
    pub hash: String,
    pub bytes: i64,
    #[serde(default)]
    pub original_bytes: Option<i64>,
    pub host: String,
    pub split: i64,
    pub progress: f64,
    pub status: String,
    pub added: String,
    #[serde(default)]
    pub files: Vec<RdTorrentFile>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub ended: Option<String>,
    #[serde(default)]
    pub speed: Option<i64>,
    #[serde(default)]
    pub seeders: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdAddTorrentResponse {
    pub id: String,
    pub uri: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdUnrestrictedLink {
    pub id: String,
    pub filename: String,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    pub filesize: i64,
    pub link: String,
    pub host: String,
    pub chunks: i64,
    #[serde(default)]
    pub crc: Option<i64>,
    pub download: String,
    #[serde(default)]
    pub streamable: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RdDownloadItem {
    pub id: String,
    pub filename: String,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    pub filesize: i64,
    pub link: String,
    pub host: String,
    pub chunks: i64,
    pub download: String,
    pub generated: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub error: String,
    pub error_code: Option<i64>,
}
