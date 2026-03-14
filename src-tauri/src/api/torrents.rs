use super::client::RdClient;
use super::types::{AddTorrentResponse, Torrent, TorrentInfo};

impl RdClient {
    /// List all torrents (paginated)
    pub async fn list_torrents(
        &self,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> Result<Vec<Torrent>, super::client::RdError> {
        let page_str = page.unwrap_or(1).to_string();
        let limit_str = limit.unwrap_or(100).to_string();
        self.get_with_params(
            "/torrents",
            &[("page", page_str.as_str()), ("limit", limit_str.as_str())],
        )
        .await
    }

    /// Get detailed info for a specific torrent
    pub async fn torrent_info(
        &self,
        id: &str,
    ) -> Result<TorrentInfo, super::client::RdError> {
        self.get(&format!("/torrents/info/{}", id)).await
    }

    /// Add a magnet link
    pub async fn add_magnet(
        &self,
        magnet: &str,
    ) -> Result<AddTorrentResponse, super::client::RdError> {
        self.post("/torrents/addMagnet", &[("magnet", magnet)])
            .await
    }

    /// Upload a .torrent file
    pub async fn add_torrent_file(
        &self,
        bytes: Vec<u8>,
    ) -> Result<AddTorrentResponse, super::client::RdError> {
        self.put_bytes("/torrents/addTorrent", bytes).await
    }

    /// Select files to download within a torrent
    pub async fn select_files(
        &self,
        id: &str,
        file_ids: &str,
    ) -> Result<(), super::client::RdError> {
        self.post_no_body(
            &format!("/torrents/selectFiles/{}", id),
            &[("files", file_ids)],
        )
        .await
    }

    /// Delete a torrent
    pub async fn delete_torrent(&self, id: &str) -> Result<(), super::client::RdError> {
        self.delete(&format!("/torrents/delete/{}", id)).await
    }
}
