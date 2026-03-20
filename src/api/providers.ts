import { invoke } from "@tauri-apps/api/core";
import type { ProviderInfo } from "../types";

export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  return invoke("get_available_providers");
}

export async function switchProvider(providerId: string): Promise<boolean> {
  return invoke("switch_provider", { providerId });
}

export async function getActiveProvider(): Promise<string> {
  return invoke("get_active_provider");
}

export async function getAuthMethod(): Promise<"api_key" | "oauth_device"> {
  return invoke("get_auth_method");
}
