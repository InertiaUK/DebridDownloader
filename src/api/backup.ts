import { invoke } from "@tauri-apps/api/core";

export interface ImportResult {
  frontend_settings: string | null;
  imported_sections: string[];
}

export async function exportSettings(
  includeCredentials: boolean,
  frontendSettingsJson: string
): Promise<string> {
  return invoke("export_settings", {
    includeCredentials,
    frontendSettingsJson,
  });
}

export async function importSettings(json: string): Promise<ImportResult> {
  return invoke("import_settings", { json });
}
