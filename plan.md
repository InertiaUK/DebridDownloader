# DebridDownloader — Tauri v2 + React + TypeScript

Cross-platform desktop app (macOS + Windows) for managing Real-Debrid torrents and batch-downloading files.

## Tech Stack
- **Desktop**: Tauri v2 (Rust backend)
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Vite 7
- **HTTP**: reqwest (Rust), async streaming downloads
- **Auth**: API token + OAuth2 device flow, OS keyring storage
- **Routing**: React Router v7

## Project Location
`/Volumes/DATA/VibeCoding/DebridDownloader`

## Build Commands
```bash
# Rust env setup (required in each shell)
export RUSTUP_HOME=/Volumes/DATA/VibeCoding/.rust/rustup
export CARGO_HOME=/Volumes/DATA/VibeCoding/.rust/cargo
. "/Volumes/DATA/VibeCoding/.rust/cargo/env"

# Dev mode
npm run tauri dev

# Production build
npm run tauri build

# TypeScript check only
npx tsc --noEmit

# Rust check only
cd src-tauri && cargo check
```

## Architecture
- `src-tauri/src/api/` — Real-Debrid API client (types, client, torrents, unrestrict, downloads)
- `src-tauri/src/commands/` — Tauri IPC commands (auth, torrents, downloads, settings)
- `src-tauri/src/downloader.rs` — Parallel file download engine with progress events
- `src-tauri/src/state.rs` — App state management
- `src/api/` — TypeScript invoke wrappers
- `src/pages/` — Auth, Torrents, Downloads, History, Settings
- `src/components/` — Layout, TorrentDetail, AddTorrentModal
- `src/hooks/` — useAuth, useDownloadProgress
