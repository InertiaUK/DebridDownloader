use super::{SearchParams, SearchResult, ScraperError, TorrentScraper};
use std::future::Future;
use std::pin::Pin;

pub struct PirateBayScraper {
    client: reqwest::Client,
}

impl PirateBayScraper {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("DebridDownloader/0.1.0")
                .build()
                .expect("Failed to create HTTP client"),
        }
    }
}

impl TorrentScraper for PirateBayScraper {
    fn name(&self) -> &str {
        "The Pirate Bay"
    }

    fn search(
        &self,
        _params: &SearchParams,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<SearchResult>, ScraperError>> + Send + '_>> {
        Box::pin(async move {
            Ok(vec![])
        })
    }
}
