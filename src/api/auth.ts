import { invoke } from "@tauri-apps/api/core";
import type { DeviceCode, DeviceCredentials, OAuthToken, User } from "../types";

export async function setApiToken(token: string): Promise<void> {
  return invoke("set_api_token", { token });
}

export async function loadSavedToken(): Promise<boolean> {
  return invoke("load_saved_token");
}

export async function logout(): Promise<void> {
  return invoke("logout");
}

export async function isAuthenticated(): Promise<boolean> {
  return invoke("is_authenticated");
}

export async function getUser(): Promise<User> {
  return invoke("get_user");
}

export async function oauthStart(): Promise<DeviceCode> {
  return invoke("oauth_start");
}

export async function oauthPollCredentials(
  deviceCode: string
): Promise<DeviceCredentials | null> {
  return invoke("oauth_poll_credentials", { deviceCode });
}

export async function oauthGetToken(
  clientId: string,
  clientSecret: string,
  deviceCode: string
): Promise<OAuthToken> {
  return invoke("oauth_get_token", { clientId, clientSecret, deviceCode });
}
