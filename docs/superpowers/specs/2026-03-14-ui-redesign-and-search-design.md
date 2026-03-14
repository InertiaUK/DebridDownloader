# UI Redesign + Torrent Search Feature — Design Spec

## Overview

Two-part effort: (1) visual overhaul of the entire app following the "Refined Dark + Green Glow" direction, and (2) a new torrent search feature that scrapes public trackers directly from the Rust backend.

---

## Part 1: UI Redesign — Refined Dark + Green Glow

### Design Direction

Keep the existing dark theme and green accent color but add depth, polish, and visual hierarchy. Subtle gradients, glow effects, better card styling, softer edges. The goal is a cohesive, premium-feeling desktop app — not a flat prototype.

### Design System Changes (`src/styles/index.css`)

- Add new theme tokens for glow/shadow utilities:
  - `--shadow-glow-green: 0 0 20px rgba(120, 190, 32, 0.15), 0 0 4px rgba(120, 190, 32, 0.1)`
  - `--shadow-glow-blue: 0 0 20px rgba(59, 130, 246, 0.15), 0 0 4px rgba(59, 130, 246, 0.1)`
- Add gradient background utilities for card states
- Softer border colors with more opacity variation (currently borders feel harsh)
- Secondary accent color: blue gradient for in-progress/downloading states, complementing the green success/ready accent
- Typography tightening: slightly larger page titles, tighter line heights, more `font-medium` usage for crispness

### Sidebar (`Layout.tsx`)

- Subtle gradient background instead of flat `bg-rd-dark`
- Active nav item gets a green glow indicator (left accent bar or background glow effect)
- Slightly more generous padding throughout
- Show user avatar (from Real-Debrid API `user.avatar`) next to username — fallback to initials avatar if `avatar` is empty string
- Show premium expiry date subtly under username

### Torrent List Cards (`TorrentsPage.tsx`)

- Each torrent row becomes a proper card with subtle gradient background + soft inner glow on hover
- Status glow dot: animated pulse for active downloads, static for others
- Well-spaced info grid: filename, size, file count, seeders, speed
- Progress bars get gradient fills: blue-to-cyan for downloading, green for complete
- Hover state: card lifts slightly with border glow matching status color
- Delete button remains reveal-on-hover

### Downloads Page (`DownloadsPage.tsx`)

- Active downloads: more prominent gradient progress bar, cleaner speed/ETA layout
- Overall stats bar at top of page: total speed, active count, completed count — styled as subtle pill badges
- Completed/failed sections: cleaner separation

### Modals (`AddTorrentModal.tsx`, `TorrentDetail.tsx`)

- Softer backdrop blur
- Slightly more rounded corners
- Smoother enter/exit CSS transitions

### Auth Page (`AuthPage.tsx`)

- Apply same refined styling: gradient card background, glow effects on the login card
- Better visual hierarchy between token and OAuth modes

### Empty States (all pages)

- More inviting CSS-drawn illustrations (no external image assets)
- Warmer, more helpful copy

### Settings Page (`SettingsPage.tsx`)

- Apply consistent card styling with gradient backgrounds
- Better visual grouping

### History Page (`HistoryPage.tsx`)

- Apply consistent card styling
- Better date formatting and visual hierarchy

---

## Part 2: Torrent Search Feature

### User Flow

1. User clicks "Search" tab in sidebar
2. Types a query into the search bar
3. Optionally selects a category filter (All, Movies, TV, Games, Software, Music, Other) and sort order (Seeders, Size, Date)
4. Results appear as a list of cards showing: title, size, seeders/leechers (color-coded), source tracker badge, upload date
5. User clicks "Add" on a result → magnet link is sent to `add_magnet` → torrent appears on Torrents page
6. If a tracker is unreachable, a subtle warning badge appears but results from other trackers still show

### Backend: Rust Scraper Architecture

#### New module: `src-tauri/src/scrapers/`

**Files:**
- `mod.rs` — `TorrentScraper` trait, `SearchResult` struct, `SearchParams` struct, aggregator function
- `piratebay.rs` — The Pirate Bay scraper (via working mirror)
- `thirteen37x.rs` — 1337x scraper

**`TorrentScraper` trait (no `async-trait` crate — uses explicit `Pin<Box>` for object safety):**
```rust
pub trait TorrentScraper: Send + Sync {
    fn name(&self) -> &str;
    fn search(&self, params: &SearchParams) -> Pin<Box<dyn Future<Output = Result<Vec<SearchResult>, ScraperError>> + Send + '_>>;
}
```

This allows the aggregator to store scrapers as `Vec<Box<dyn TorrentScraper>>` and call `futures::future::join_all` over the collection. Each scraper implements the trait with an `async` block wrapped in `Box::pin(async move { ... })`.

**`SearchResult` struct:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub magnet: String,
    pub info_hash: String,    // lowercase hex, extracted from magnet URI xt=urn:btih:... — MUST always be populated
    pub size_bytes: u64,
    pub size_display: String,
    pub seeders: u32,
    pub leechers: u32,
    pub date: String,
    pub source: String,       // tracker name
    pub category: String,
}
```

**`SearchParams` struct:**
```rust
#[derive(Debug, Clone, Deserialize)]
pub struct SearchParams {
    pub query: String,
    pub category: Option<String>,  // "movies", "tv", "games", "software", "music"
    pub sort_by: Option<String>,   // "seeders" (default), "size", "date"
    pub page: Option<u32>,
}
```

**`ScraperError` enum:**
```rust
#[derive(Debug, thiserror::Error)]
pub enum ScraperError {
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    #[error("Failed to parse HTML response")]
    ParseError(String),
    #[error("Scraper timed out after {0}s")]
    Timeout(u64),
    #[error("Tracker returned CAPTCHA or block page")]
    Blocked,
}
```

**`TrackerStatus` struct:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerStatus {
    pub name: String,
    pub ok: bool,
    pub error: Option<String>,
}
```

**`SearchResponse` struct:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
    pub tracker_status: Vec<TrackerStatus>,
}
```

**`info_hash` extraction:**
Every scraper MUST extract `info_hash` from the magnet URI by parsing the `xt=urn:btih:` parameter and normalizing to lowercase hex. This is required for deduplication. A shared utility function in `mod.rs` should handle this: `fn extract_info_hash(magnet: &str) -> Option<String>`.

**Aggregator function:**
- Runs all scrapers concurrently with `futures::future::join_all` (already in `Cargo.toml` — NOT `tokio::join!` which requires fixed arity)
- Each scraper wrapped in `tokio::time::timeout(Duration::from_secs(10), ...)`
- Merges results, deduplicates by `info_hash`
- Sorts merged results by the requested sort field
- Returns `SearchResponse` with results + tracker statuses

**Pagination strategy:**
Each scraper passes `params.page` directly to its tracker's URL (both 1337x and TPB support page parameters). Results are merged and deduplicated within the current page only. This means page sizes may vary slightly but keeps implementation simple and avoids fetching entire result sets.

**Scraper implementation notes:**
- 1337x: base URL `https://www.1337x.to`, search path `/search/{query}/{page}/`, sort paths vary by sort type. Parse the results table rows for title, size, seeders, leechers, date. Follow the detail page link to extract the magnet URI.
- The Pirate Bay: use the `apibay.org` API endpoint which returns JSON (not HTML), making it more reliable than mirror scraping. Endpoint: `https://apibay.org/q.php?q={query}&cat={cat}`. Returns JSON array with `name`, `info_hash`, `seeders`, `leechers`, `size`, `added`. Magnet URI constructed from info_hash + tracker list.
- Both scrapers should handle CAPTCHAs/block pages by detecting non-standard response bodies and returning `ScraperError::Blocked`

**Dependencies to add to `Cargo.toml`:**
- `scraper` — HTML parsing with CSS selectors (for 1337x)

Note: `async-trait` is NOT needed — use native Rust async trait syntax. `futures` is already a dependency.

#### New Tauri commands: `src-tauri/src/commands/search.rs`

- `search_torrents(query: String, category: Option<String>, sort_by: Option<String>, page: Option<u32>)` → returns `SearchResponse { results: Vec<SearchResult>, tracker_status: Vec<TrackerStatus> }`
- Register in `lib.rs` `generate_handler![]`

### Frontend: Search Page

#### New files:
- `src/api/search.ts` — invoke wrapper for `search_torrents`
- `src/pages/SearchPage.tsx` — the search page component
- New types in `src/types/index.ts` — `SearchResult`, `SearchResponse`, `TrackerStatus`

#### `SearchPage.tsx` layout:
- **Top bar:** Search input (prominent, full-width) with search button
- **Filter row:** Category dropdown (All | Movies | TV | Games | Software | Music | Other), Sort by dropdown (Seeders | Size | Date)
- **Results list:** Cards showing:
  - Title (bold, truncated)
  - Size
  - Seeders/leechers with color coding (green ≥ 10 seeders, yellow 1-9, red 0)
  - Source tracker badge (small pill)
  - Upload date
  - "Add" button on the right → calls `addMagnet(result.magnet)` then `selectTorrentFiles(id, "all")` (the Real-Debrid API accepts the literal string `"all"` to select all files — this is already used in `AddTorrentModal.tsx`)
- **Loading state:** Skeleton card placeholders while scraping
- **Empty state:** Helpful prompt before first search
- **Tracker warnings:** If a tracker failed, subtle banner at top: "1337x unavailable — showing results from other sources"
- **Pagination:** Prev/Next at bottom

#### Routing:
- Add `/search` route in `App.tsx` inside the authenticated layout
- Add "Search" nav item in `Layout.tsx` between Torrents and Downloads (magnifying glass icon)

---

## Tauri Capabilities

The scraper makes outbound HTTP requests to domains not covered by the existing Real-Debrid API allowlist. Tauri v2's capability system may block these in production builds. Check `src-tauri/capabilities/` (if it exists) or `tauri.conf.json` security settings. Since `"csp": null` is currently set (permissive), outbound `reqwest` calls from the Rust backend should work without additional configuration — CSP only applies to the webview, not Rust-side HTTP. No changes needed.

---

## What's NOT in scope

- Private tracker support (that's Jackett/Prowlarr territory — future feature)
- Light theme
- Drag-and-drop torrent file upload
- Download scheduling
- Any external service dependencies
