use reqwest::{Client, Response, StatusCode};
use serde::de::DeserializeOwned;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::types::ApiError;

const BASE_URL: &str = "https://api.real-debrid.com/rest/1.0";
const OAUTH_URL: &str = "https://api.real-debrid.com/oauth/v2";
pub const OPEN_SOURCE_CLIENT_ID: &str = "X245A4XAIBGVM";

#[derive(Debug, thiserror::Error)]
pub enum RdError {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("API error ({code}): {message}")]
    Api { message: String, code: i64 },

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Rate limited — wait and retry")]
    RateLimited,

    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for RdError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Clone)]
pub struct RdClient {
    http: Client,
    token: Arc<RwLock<Option<String>>>,
}

impl RdClient {
    pub fn new() -> Self {
        Self {
            http: Client::builder()
                .user_agent("DebridDownloader/0.1.0")
                .build()
                .expect("Failed to create HTTP client"),
            token: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn set_token(&self, token: String) {
        let mut t = self.token.write().await;
        *t = Some(token);
    }

    pub async fn clear_token(&self) {
        let mut t = self.token.write().await;
        *t = None;
    }

    pub async fn has_token(&self) -> bool {
        self.token.read().await.is_some()
    }

    async fn get_token(&self) -> Result<String, RdError> {
        self.token
            .read()
            .await
            .clone()
            .ok_or(RdError::NotAuthenticated)
    }

    /// Make an authenticated GET request to the REST API
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, RdError> {
        let token = self.get_token().await?;
        let url = format!("{}{}", BASE_URL, path);
        let resp = self
            .http
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;
        self.handle_response(resp).await
    }

    /// Make an authenticated GET request with query params
    pub async fn get_with_params<T: DeserializeOwned>(
        &self,
        path: &str,
        params: &[(&str, &str)],
    ) -> Result<T, RdError> {
        let token = self.get_token().await?;
        let url = format!("{}{}", BASE_URL, path);
        let resp = self
            .http
            .get(&url)
            .header("Authorization", format!("Bearer {}", token))
            .query(params)
            .send()
            .await?;
        self.handle_response(resp).await
    }

    /// Make an authenticated POST request
    pub async fn post<T: DeserializeOwned>(
        &self,
        path: &str,
        form: &[(&str, &str)],
    ) -> Result<T, RdError> {
        let token = self.get_token().await?;
        let url = format!("{}{}", BASE_URL, path);
        let resp = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .form(form)
            .send()
            .await?;
        self.handle_response(resp).await
    }

    /// Make an authenticated POST that returns no body (204)
    pub async fn post_no_body(&self, path: &str, form: &[(&str, &str)]) -> Result<(), RdError> {
        let token = self.get_token().await?;
        let url = format!("{}{}", BASE_URL, path);
        let resp = self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", token))
            .form(form)
            .send()
            .await?;
        self.handle_empty_response(resp).await
    }

    /// Make an authenticated DELETE request
    pub async fn delete(&self, path: &str) -> Result<(), RdError> {
        let token = self.get_token().await?;
        let url = format!("{}{}", BASE_URL, path);
        let resp = self
            .http
            .delete(&url)
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await?;
        self.handle_empty_response(resp).await
    }

    /// Make an authenticated PUT request with raw bytes (for torrent file upload)
    pub async fn put_bytes<T: DeserializeOwned>(
        &self,
        path: &str,
        bytes: Vec<u8>,
    ) -> Result<T, RdError> {
        let token = self.get_token().await?;
        let url = format!("{}{}", BASE_URL, path);
        let resp = self
            .http
            .put(&url)
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/octet-stream")
            .body(bytes)
            .send()
            .await?;
        self.handle_response(resp).await
    }

    // ── OAuth endpoints (no auth required) ──

    /// GET device code for OAuth2 device flow
    pub async fn oauth_device_code<T: DeserializeOwned>(&self) -> Result<T, RdError> {
        let url = format!(
            "{}/device/code?client_id={}&new_credentials=yes",
            OAUTH_URL, OPEN_SOURCE_CLIENT_ID
        );
        let resp = self.http.get(&url).send().await?;
        self.handle_response(resp).await
    }

    /// Poll for device credentials
    pub async fn oauth_device_credentials<T: DeserializeOwned>(
        &self,
        device_code: &str,
    ) -> Result<T, RdError> {
        let url = format!(
            "{}/device/credentials?client_id={}&code={}",
            OAUTH_URL, OPEN_SOURCE_CLIENT_ID, device_code
        );
        let resp = self.http.get(&url).send().await?;
        self.handle_response(resp).await
    }

    /// Exchange device code for token
    pub async fn oauth_token<T: DeserializeOwned>(
        &self,
        client_id: &str,
        client_secret: &str,
        device_code: &str,
    ) -> Result<T, RdError> {
        let url = format!("{}/token", OAUTH_URL);
        let resp = self
            .http
            .post(&url)
            .form(&[
                ("client_id", client_id),
                ("client_secret", client_secret),
                ("code", device_code),
                (
                    "grant_type",
                    "http://oauth.net/grant_type/device/1.0",
                ),
            ])
            .send()
            .await?;
        self.handle_response(resp).await
    }

    /// Get a streaming response for file download
    pub async fn download_stream(&self, url: &str) -> Result<Response, RdError> {
        let resp = self.http.get(url).send().await?;
        if !resp.status().is_success() {
            return Err(RdError::Other(format!(
                "Download failed with status {}",
                resp.status()
            )));
        }
        Ok(resp)
    }

    // ── Response handlers ──

    async fn handle_response<T: DeserializeOwned>(&self, resp: Response) -> Result<T, RdError> {
        let status = resp.status();

        if status == StatusCode::TOO_MANY_REQUESTS {
            return Err(RdError::RateLimited);
        }

        if status.is_success() {
            let body = resp.json::<T>().await?;
            return Ok(body);
        }

        // Try to parse API error
        if let Ok(api_err) = resp.json::<ApiError>().await {
            return Err(RdError::Api {
                message: api_err.error,
                code: api_err.error_code.unwrap_or(-1),
            });
        }

        Err(RdError::Other(format!("Unexpected status: {}", status)))
    }

    async fn handle_empty_response(&self, resp: Response) -> Result<(), RdError> {
        let status = resp.status();

        if status == StatusCode::TOO_MANY_REQUESTS {
            return Err(RdError::RateLimited);
        }

        if status.is_success() {
            return Ok(());
        }

        if let Ok(api_err) = resp.json::<ApiError>().await {
            return Err(RdError::Api {
                message: api_err.error,
                code: api_err.error_code.unwrap_or(-1),
            });
        }

        Err(RdError::Other(format!("Unexpected status: {}", status)))
    }
}
