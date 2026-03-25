# Watch List / RSS Automation — Design Spec

## Overview

Add a watch list feature that monitors user-configured trackers for new content matching saved rules, with two rule types: freeform **Keyword** matching and smart **TV Show** episode tracking. Each rule can be configured to either notify the user or automatically add matched torrents to their debrid provider.

## Data Model

### WatchRule

Persisted in Tauri plugin-store (`settings.json`) under key `watch_rules`.

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchRule {
    pub id: String,                    // UUID v4
    pub name: String,                  // user-facing label
    pub rule_type: RuleType,           // Keyword or TvShow
    pub query: String,                 // search query sent to scrapers
    pub category: Option<String>,      // "tv", "movies", "music", "games", "software"
    pub regex_filter: Option<String>,  // optional regex applied to result titles
    pub min_seeders: Option<u32>,
    pub min_size_bytes: Option<u64>,
    pub max_size_bytes: Option<u64>,
    pub action: WatchAction,           // Notify or AutoAdd
    pub interval_minutes: u32,         // polling interval (default 30)
    pub enabled: bool,
    pub created_at: String,            // ISO 8601
    pub last_checked: Option<String>,  // ISO 8601
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RuleType {
    Keyword,
    TvShow {
        last_season: Option<u32>,
        last_episode: Option<u32>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WatchAction {
    Notify,
    AutoAdd,
}
```

### WatchMatch

Persisted in Tauri plugin-store under key `watch_matches`. Capped at 500 entries; oldest pruned on insert.

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchMatch {
    pub rule_id: String,
    pub info_hash: String,
    pub magnet: String,                // full magnet URI (for one-click add on Notify matches)
    pub title: String,
    pub size_bytes: u64,
    pub matched_at: String,            // ISO 8601
    pub action_taken: WatchAction,
    pub status: MatchStatus,           // tracks auto-add outcome
    pub season: Option<u32>,           // parsed from title (TV rules)
    pub episode: Option<u32>,          // parsed from title (TV rules)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MatchStatus {
    Notified,                          // Notify action — user informed
    Added,                             // AutoAdd succeeded
    Failed(String),                    // AutoAdd attempted but failed
}
```

### Deduplication

Dedup is **per-rule**: the seen-hashes set is built as `HashMap<rule_id, HashSet<info_hash>>` derived from `WatchMatch` records. A match from Rule A does not suppress the same hash appearing in Rule B.

To prevent dedup drift when old matches are pruned from the 500-entry cap, a separate lightweight store key `watch_seen_hashes` persists a `HashMap<String, HashSet<String>>` (rule_id → info_hash set) capped at 5000 entries per rule. This set is the authoritative dedup source; `WatchMatch` records are for display only.

Results with empty `info_hash` are skipped by the watch loop.

## Backend Engine

### Episode Parser

Utility function in `watchlist.rs`:

```
parse_episode("Show.Name.S03E07.1080p...") → Some((3, 7))
parse_episode("Show.Name.S3E7.720p...")    → Some((3, 7))
parse_episode("Show.Name.3x07.HDTV...")    → Some((3, 7))
parse_episode("random.linux.iso")          → None
```

Regex patterns (case-insensitive):
- `S(\d{1,2})E(\d{1,2})`
- `(\d{1,2})x(\d{2})`

### Watch Loop

New module: `src-tauri/src/watchlist.rs`

Single tokio task spawned at app startup. Accepts a `CancellationToken` (from `tokio_util`) stored in `AppState` for graceful shutdown. Loops:

1. `tokio::select!` between cancellation token and 60-second sleep (tick interval)
2. If no trackers are configured, skip the entire tick (log once per session, not every tick)
3. For each enabled rule where `now - last_checked >= interval_minutes`:
   a. Snapshot the rule (clone from the RwLock) — work against the snapshot, not the locked data
   b. Call `search_all()` with the rule's query + category against user's tracker configs
   c. Filter results: skip empty `info_hash`, apply regex filter if set, check min_seeders/size bounds
   d. **Keyword rules:** skip results whose `info_hash` is in the per-rule seen set
   e. **TvShow rules:** parse episode from each title. If `last_season` and `last_episode` are both `None`, accept all results (bootstrapping — first poll seeds the position). Otherwise skip if `(season, episode) <= (last_season, last_episode)`. Also skip per-rule seen hashes. If a result has no parseable episode, skip it for TV rules.
   f. For each new match:
      - If `Notify`: record `WatchMatch` with `status: Notified`, emit `watchlist-match` Tauri event
      - If `AutoAdd`: attempt the auto-add flow (see below). Record `WatchMatch` with `status: Added` or `status: Failed(reason)`. On failure, emit `watchlist-match` event with the failure so the user is aware.
   g. Re-acquire the write lock. Check the rule still exists and has not been modified by the user (compare `last_checked` timestamp with the snapshot). If unchanged, update `last_checked` and for TV rules update `last_season`/`last_episode` to highest seen. If the rule was modified, skip the write-back (user's edit takes priority).
   h. Update the per-rule seen hashes set
   i. Persist updated rules, matches, and seen hashes to the store

### Tauri Commands

New file: `src-tauri/src/commands/watchlist.rs`

- `get_watch_rules() → Vec<WatchRule>`
- `add_watch_rule(rule) → WatchRule` — validates regex_filter at creation time, returns error if invalid
- `update_watch_rule(rule) → WatchRule` — validates regex_filter, returns error if invalid
- `delete_watch_rule(id)`
- `get_watch_matches(rule_id: Option<String>) → Vec<WatchMatch>`
- `clear_watch_matches(rule_id: Option<String>)`
- `run_watch_rule_now(id)` — manual trigger for testing

## Persistence & State Integration

### AppState Changes

```rust
pub struct AppState {
    // ...existing fields...
    pub watch_rules: Arc<RwLock<Vec<WatchRule>>>,
    pub watch_matches: Arc<RwLock<Vec<WatchMatch>>>,
    pub watch_seen: Arc<RwLock<HashMap<String, HashSet<String>>>>, // rule_id → seen hashes
    pub watch_cancel: CancellationToken,  // from tokio_util
}
```

### Startup Sequence

1. Load `watch_rules` and `watch_matches` from plugin-store in `setup()`
2. Populate `AppState` fields
3. Spawn `watchlist::start_watch_loop(app_handle, cancel_token)` as a detached tokio task. Cancel the token during app shutdown (in Tauri's `on_window_event` close handler).

### Auto-Add Flow

When a match triggers auto-add:

1. `provider.add_magnet(magnet)` — adds to debrid service. If this fails (auth expired, rate limit, network), record `WatchMatch` with `status: Failed(reason)` and move to next match. The info_hash is still added to the seen set to avoid retrying on every tick; the user can manually add from the match record.
2. Poll `provider.torrent_info(id)` with exponential backoff (1s, 2s, 4s, 8s) up to 60 seconds total, waiting for the torrent to have files available (status indicates processing complete).
3. Once files are available, call `provider.select_files(id, all_file_ids)` with the file IDs from `torrent_info`. If this fails, log a warning but still record as `Added` (the torrent exists on the provider, user can select files manually).
4. If download folder is configured, emit `start-downloads` event (same flow as manual).

If `torrent_info` polling times out (torrent not cached/slow processing), record as `Added` — the torrent is on the provider and will become available eventually. The user sees it on their Torrents page.

This keeps auto-add consistent with the existing manual download path.

### Storage Limits

- `watch_matches` capped at 500 entries, oldest pruned on insert (display only)
- `watch_seen_hashes` capped at 5000 entries per rule (authoritative dedup source, separate from match display)
- No limit on `watch_rules` (practical limit is user-managed)
- When a rule is deleted, its entries in `watch_matches` and `watch_seen_hashes` are cleaned up

## Frontend

### Sidebar

New entry: "Watch List" with eye icon, positioned between Search and Downloads. Badge shows count of unread matches (matches since user last visited the page).

### Watch List Page Layout

**Top panel: Rules list**

Table showing all watch rules:
- Columns: Name, Type (Keyword/TV badge), Query, Action (Notify/Auto-Add badge), Interval, Last Checked, Enabled toggle
- TV rules show tracking position badge (e.g., "S03E07")
- "Add Rule" button opens modal
- Row actions: Edit, Run Now, Delete

**Bottom panel: Recent Matches**

Filtered by selected rule (or show all):
- Columns: Title, Rule Name, Matched At, Action Taken, Size
- Auto-added matches show link icon to jump to Torrents page
- "Clear" button to purge match history

### Add/Edit Rule Modal

Fields:
- Name (text input)
- Rule type toggle: Keyword / TV Show
- Query string (text input)
- Category dropdown: All, Movies, TV, Music, Games, Software
- For TV Show type: Season/Episode number fields (optional — auto-detected from first match if blank)
- Advanced section (collapsible): regex filter, min seeders, min/max size
- Action toggle: Notify / Auto-Add
- Interval dropdown: 15m, 30m, 1h, 2h, 6h

### Notifications

- `watchlist-match` event triggers a toast when user is not on Watch List page. Failed auto-adds show a warning toast.
- Sidebar badge increments with unread match count
- Unread count tracks matches since the user last visited the Watch List page. The `last_visited_watchlist` timestamp is stored in localStorage (resets to "all unread" on app restart, which is acceptable — keeps it simple)
- Notify matches show a one-click "Add" button in the matches table (uses the stored `magnet` field)

## Files to Create/Modify

### New Files
- `src-tauri/src/watchlist.rs` — watch engine, episode parser, watch loop
- `src-tauri/src/commands/watchlist.rs` — Tauri command handlers
- `src/pages/WatchListPage.tsx` — full watch list page
- `src/api/watchlist.ts` — invoke() wrappers

### Modified Files
- `src-tauri/src/state.rs` — add watch_rules/watch_matches to AppState
- `src-tauri/src/lib.rs` — register commands, spawn watch loop in setup
- `src-tauri/src/commands/mod.rs` — add watchlist module
- `src/types/index.ts` — add WatchRule, WatchMatch, RuleType, WatchAction interfaces
- `src/components/Sidebar.tsx` — add Watch List nav entry with badge
- `src/App.tsx` (or router config) — add route for Watch List page
