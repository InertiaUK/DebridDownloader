use super::client::RdClient;
use super::types::UnrestrictedLink;

impl RdClient {
    /// Unrestrict a link to get a direct download URL
    pub async fn unrestrict_link(
        &self,
        link: &str,
    ) -> Result<UnrestrictedLink, super::client::RdError> {
        self.post("/unrestrict/link", &[("link", link)]).await
    }
}
