use serde::{Deserialize, Serialize};

// ── Authentication ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub interval: u64,
    pub expires_in: u64,
    pub verification_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCredentials {
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthToken {
    pub access_token: String,
    pub expires_in: u64,
    pub token_type: String,
    pub refresh_token: String,
}

// ── User ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
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

// ── Torrents ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Torrent {
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
pub struct TorrentFile {
    pub id: u64,
    pub path: String,
    pub bytes: i64,
    pub selected: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentInfo {
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
    pub files: Vec<TorrentFile>,
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
pub struct AddTorrentResponse {
    pub id: String,
    pub uri: String,
}

// ── Unrestrict ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnrestrictedLink {
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

// ── Downloads History ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadItem {
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

// ── Active Count ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveCount {
    pub nb: u64,
    pub limit: u64,
}

// ── API Error ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub error: String,
    pub error_code: Option<i64>,
}
