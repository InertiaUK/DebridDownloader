use super::client::RdClient;
use super::types::DownloadItem;

impl RdClient {
    /// List download history
    pub async fn list_downloads(
        &self,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> Result<Vec<DownloadItem>, super::client::RdError> {
        let page_str = page.unwrap_or(1).to_string();
        let limit_str = limit.unwrap_or(100).to_string();
        self.get_with_params(
            "/downloads",
            &[("page", page_str.as_str()), ("limit", limit_str.as_str())],
        )
        .await
    }

    /// Delete a download from history
    pub async fn delete_download(&self, id: &str) -> Result<(), super::client::RdError> {
        self.delete(&format!("/downloads/delete/{}", id)).await
    }
}
