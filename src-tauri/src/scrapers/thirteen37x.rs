use super::{SearchParams, SearchResult, ScraperError, TorrentScraper};
use std::future::Future;
use std::pin::Pin;

pub struct Thirteen37xScraper {
    client: reqwest::Client,
}

impl Thirteen37xScraper {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("DebridDownloader/0.1.0")
                .build()
                .expect("Failed to create HTTP client"),
        }
    }
}

impl TorrentScraper for Thirteen37xScraper {
    fn name(&self) -> &str {
        "1337x"
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
