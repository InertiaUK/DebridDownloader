use crate::api::types::{DeviceCode, DeviceCredentials, OAuthToken, User};
use crate::state::AppState;
use keyring::Entry;
use tauri::State;

const KEYRING_SERVICE: &str = "com.jonathan.debriddownloader";
const KEYRING_TOKEN_KEY: &str = "api_token";
const KEYRING_REFRESH_KEY: &str = "refresh_token";
const KEYRING_CLIENT_ID_KEY: &str = "oauth_client_id";
const KEYRING_CLIENT_SECRET_KEY: &str = "oauth_client_secret";

fn get_entry(key: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, key).map_err(|e| format!("Keyring error: {}", e))
}

/// Save API token to keyring and set it on the client
#[tauri::command]
pub async fn set_api_token(state: State<'_, AppState>, token: String) -> Result<(), String> {
    // Save to keyring
    let entry = get_entry(KEYRING_TOKEN_KEY)?;
    entry.set_password(&token).map_err(|e| format!("Failed to save token: {}", e))?;

    // Set on client
    state.client.set_token(token).await;
    Ok(())
}

/// Load token from keyring and set it on the client
#[tauri::command]
pub async fn load_saved_token(state: State<'_, AppState>) -> Result<bool, String> {
    let entry = get_entry(KEYRING_TOKEN_KEY)?;
    match entry.get_password() {
        Ok(token) => {
            state.client.set_token(token).await;
            Ok(true)
        }
        Err(_) => Ok(false),
    }
}

/// Clear stored token
#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    state.client.clear_token().await;
    let _ = get_entry(KEYRING_TOKEN_KEY).and_then(|e| {
        e.delete_credential().map_err(|e| format!("{}", e))
    });
    let _ = get_entry(KEYRING_REFRESH_KEY).and_then(|e| {
        e.delete_credential().map_err(|e| format!("{}", e))
    });
    let _ = get_entry(KEYRING_CLIENT_ID_KEY).and_then(|e| {
        e.delete_credential().map_err(|e| format!("{}", e))
    });
    let _ = get_entry(KEYRING_CLIENT_SECRET_KEY).and_then(|e| {
        e.delete_credential().map_err(|e| format!("{}", e))
    });
    Ok(())
}

/// Check if we're authenticated
#[tauri::command]
pub async fn is_authenticated(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.client.has_token().await)
}

/// Get current user info (also validates the token)
#[tauri::command]
pub async fn get_user(state: State<'_, AppState>) -> Result<User, String> {
    state
        .client
        .get("/user")
        .await
        .map_err(|e| format!("{}", e))
}

// ── OAuth2 Device Flow ──

#[tauri::command]
pub async fn oauth_start(state: State<'_, AppState>) -> Result<DeviceCode, String> {
    state
        .client
        .oauth_device_code()
        .await
        .map_err(|e| format!("{}", e))
}

#[tauri::command]
pub async fn oauth_poll_credentials(
    state: State<'_, AppState>,
    device_code: String,
) -> Result<Option<DeviceCredentials>, String> {
    match state
        .client
        .oauth_device_credentials::<DeviceCredentials>(&device_code)
        .await
    {
        Ok(creds) => {
            // Save credentials to keyring
            let _ = get_entry(KEYRING_CLIENT_ID_KEY)
                .and_then(|e| e.set_password(&creds.client_id).map_err(|e| format!("{}", e)));
            let _ = get_entry(KEYRING_CLIENT_SECRET_KEY)
                .and_then(|e| e.set_password(&creds.client_secret).map_err(|e| format!("{}", e)));
            Ok(Some(creds))
        }
        Err(_) => Ok(None), // Not yet authorized, keep polling
    }
}

#[tauri::command]
pub async fn oauth_get_token(
    state: State<'_, AppState>,
    client_id: String,
    client_secret: String,
    device_code: String,
) -> Result<OAuthToken, String> {
    let token: OAuthToken = state
        .client
        .oauth_token(&client_id, &client_secret, &device_code)
        .await
        .map_err(|e| format!("{}", e))?;

    // Save tokens
    let _ = get_entry(KEYRING_TOKEN_KEY)
        .and_then(|e| e.set_password(&token.access_token).map_err(|e| format!("{}", e)));
    let _ = get_entry(KEYRING_REFRESH_KEY)
        .and_then(|e| e.set_password(&token.refresh_token).map_err(|e| format!("{}", e)));

    // Set on client
    state.client.set_token(token.access_token.clone()).await;

    Ok(token)
}
