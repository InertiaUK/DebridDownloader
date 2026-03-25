# Watch List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a watch list feature that monitors user-configured trackers for new content matching saved rules, with keyword and TV show rule types, configurable notify/auto-add actions.

**Architecture:** New `watchlist` Rust module handles data types, episode parsing, and a background polling loop. New Tauri commands expose CRUD + manual trigger. Frontend adds a dedicated Watch List page with rules table, matches panel, and add/edit modal. All state persisted via Tauri plugin-store.

**Tech Stack:** Rust (tokio, regex, serde, chrono, uuid, tokio_util), React/TypeScript, Tauri v2 plugin-store, Tauri events

**Spec:** `docs/superpowers/specs/2026-03-24-watch-list-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src-tauri/src/watchlist.rs` | Data types (`WatchRule`, `WatchMatch`, `RuleType`, `WatchAction`, `MatchStatus`), episode parser, result filtering, watch loop, auto-add flow, store persistence helpers |
| `src-tauri/src/commands/watchlist.rs` | Tauri command handlers (CRUD rules, query matches, clear matches, run now) |
| `src/api/watchlist.ts` | Frontend `invoke()` wrappers for all watchlist commands |
| `src/pages/WatchListPage.tsx` | Full watch list page: rules table (top), matches panel (bottom), add/edit modal |

### Modified Files
| File | Changes |
|------|---------|
| `src-tauri/Cargo.toml` | Add `tokio-util` and `regex` dependencies |
| `src-tauri/src/state.rs` | Add `watch_rules`, `watch_matches`, `watch_seen`, `watch_cancel` fields to `AppState` |
| `src-tauri/src/lib.rs` | Add `mod watchlist`, register watchlist commands, load watch data from store in `setup()`, spawn watch loop |
| `src-tauri/src/commands/mod.rs` | Add `pub mod watchlist;` |
| `src/types/index.ts` | Add `WatchRule`, `WatchMatch`, `RuleType`, `WatchAction`, `MatchStatus` interfaces |
| `src/App.tsx` | Add `WatchListPage` route at `/watchlist` |
| `src/components/Layout.tsx` | Add `watchlist` to `activeView` derivation |
| `src/components/Sidebar.tsx` | Add Watch List nav item with eye icon + unread badge after Search in System section |

---

### Task 1: Add dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add tokio-util and regex to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
tokio-util = "0.7"
regex = "1"
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add tokio-util and regex dependencies for watch list"
```

---

### Task 2: Data types and episode parser

**Files:**
- Create: `src-tauri/src/watchlist.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod watchlist;`)

- [ ] **Step 1: Create watchlist.rs with data types**

Create `src-tauri/src/watchlist.rs` with:

```rust
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

// ── Data Types ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchRule {
    pub id: String,
    pub name: String,
    pub rule_type: RuleType,
    pub query: String,
    pub category: Option<String>,
    pub regex_filter: Option<String>,
    pub min_seeders: Option<u32>,
    pub min_size_bytes: Option<u64>,
    pub max_size_bytes: Option<u64>,
    pub action: WatchAction,
    pub interval_minutes: u32,
    pub enabled: bool,
    pub created_at: String,
    pub last_checked: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum RuleType {
    Keyword,
    TvShow {
        last_season: Option<u32>,
        last_episode: Option<u32>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WatchAction {
    Notify,
    AutoAdd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchMatch {
    pub rule_id: String,
    pub info_hash: String,
    pub magnet: String,
    pub title: String,
    pub size_bytes: u64,
    pub matched_at: String,
    pub action_taken: WatchAction,
    pub status: MatchStatus,
    pub season: Option<u32>,
    pub episode: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "reason")]
pub enum MatchStatus {
    Notified,
    Added,
    Failed(String),
}

// ── Episode Parser ──────────────────────────────────────────────────

static EPISODE_RE: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        Regex::new(r"(?i)S(\d{1,2})E(\d{1,2})").unwrap(),
        Regex::new(r"(?i)(\d{1,2})x(\d{2})").unwrap(),
    ]
});

pub fn parse_episode(title: &str) -> Option<(u32, u32)> {
    for re in EPISODE_RE.iter() {
        if let Some(caps) = re.captures(title) {
            let season: u32 = caps[1].parse().ok()?;
            let episode: u32 = caps[2].parse().ok()?;
            return Some((season, episode));
        }
    }
    None
}

// ── Result Filtering ────────────────────────────────────────────────

use crate::scrapers::SearchResult;

pub fn filter_results(
    results: &[SearchResult],
    rule: &WatchRule,
    seen: &HashSet<String>,
) -> Vec<SearchResult> {
    let regex = rule
        .regex_filter
        .as_ref()
        .and_then(|r| Regex::new(r).ok());

    results
        .iter()
        .filter(|r| {
            // Skip empty info_hash
            if r.info_hash.is_empty() {
                return false;
            }
            // Per-rule dedup
            if seen.contains(&r.info_hash) {
                return false;
            }
            // Regex filter
            if let Some(ref re) = regex {
                if !re.is_match(&r.title) {
                    return false;
                }
            }
            // Min seeders
            if let Some(min) = rule.min_seeders {
                if r.seeders < min {
                    return false;
                }
            }
            // Size bounds
            if let Some(min) = rule.min_size_bytes {
                if r.size_bytes < min {
                    return false;
                }
            }
            if let Some(max) = rule.max_size_bytes {
                if r.size_bytes > max {
                    return false;
                }
            }
            // TV show episode filtering
            if let RuleType::TvShow {
                last_season,
                last_episode,
            } = &rule.rule_type
            {
                match parse_episode(&r.title) {
                    None => return false, // no episode info → skip for TV rules
                    Some((s, e)) => {
                        // If both are None, accept all (bootstrapping)
                        if let (Some(ls), Some(le)) = (last_season, last_episode) {
                            if (s, e) <= (*ls, *le) {
                                return false;
                            }
                        }
                    }
                }
            }
            true
        })
        .cloned()
        .collect()
}

/// Validate that a regex string compiles. Returns Ok(()) or Err with message.
pub fn validate_regex(pattern: &str) -> Result<(), String> {
    Regex::new(pattern).map(|_| ()).map_err(|e| format!("Invalid regex: {}", e))
}
```

- [ ] **Step 2: Add mod declaration to lib.rs**

In `src-tauri/src/lib.rs`, add after the existing mod declarations:

```rust
mod watchlist;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/watchlist.rs src-tauri/src/lib.rs
git commit -m "feat(watchlist): add data types, episode parser, and result filtering"
```

---

### Task 3: AppState changes

**Files:**
- Modify: `src-tauri/src/state.rs`

- [ ] **Step 1: Add watchlist fields to AppState**

Add imports at top of `src-tauri/src/state.rs`:

```rust
use std::collections::HashSet;
use tokio_util::sync::CancellationToken;
use crate::watchlist::{WatchRule, WatchMatch};
```

Add fields to `AppState` struct:

```rust
pub watch_rules: Arc<RwLock<Vec<WatchRule>>>,
pub watch_matches: Arc<RwLock<Vec<WatchMatch>>>,
pub watch_seen: Arc<RwLock<HashMap<String, HashSet<String>>>>,
pub watch_cancel: CancellationToken,
```

Add initialization in `AppState::new()`:

```rust
watch_rules: Arc::new(RwLock::new(Vec::new())),
watch_matches: Arc::new(RwLock::new(Vec::new())),
watch_seen: Arc::new(RwLock::new(HashMap::new())),
watch_cancel: CancellationToken::new(),
```

- [ ] **Step 2: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat(watchlist): add watch list fields to AppState"
```

---

### Task 4: Tauri commands

**Files:**
- Create: `src-tauri/src/commands/watchlist.rs`
- Modify: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Create commands/watchlist.rs**

Create `src-tauri/src/commands/watchlist.rs`:

```rust
use crate::scrapers::TrackerConfig;
use crate::state::AppState;
use crate::watchlist::{self, WatchMatch, WatchRule, WatchAction, RuleType, MatchStatus, MAX_MATCHES};
use tauri::{Manager, State};
use tauri_plugin_store::StoreExt;

// ── Store helpers ───────────────────────────────────────────────────

fn save_rules(app: &tauri::AppHandle, rules: &[WatchRule]) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let json = serde_json::to_value(rules).map_err(|e| e.to_string())?;
    store.set("watch_rules", json);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

fn save_matches(app: &tauri::AppHandle, matches: &[WatchMatch]) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let json = serde_json::to_value(matches).map_err(|e| e.to_string())?;
    store.set("watch_matches", json);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

fn save_seen(
    app: &tauri::AppHandle,
    seen: &std::collections::HashMap<String, std::collections::HashSet<String>>,
) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let json = serde_json::to_value(seen).map_err(|e| e.to_string())?;
    store.set("watch_seen_hashes", json);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

// ── Commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_watch_rules(state: State<'_, AppState>) -> Result<Vec<WatchRule>, String> {
    let rules = state.watch_rules.read().await;
    Ok(rules.clone())
}

#[tauri::command]
pub async fn add_watch_rule(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    rule: WatchRule,
) -> Result<WatchRule, String> {
    // Validate regex if provided
    if let Some(ref pattern) = rule.regex_filter {
        if !pattern.is_empty() {
            watchlist::validate_regex(pattern)?;
        }
    }

    let mut rules = state.watch_rules.write().await;
    rules.push(rule.clone());
    save_rules(&app, &rules)?;
    Ok(rule)
}

#[tauri::command]
pub async fn update_watch_rule(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    rule: WatchRule,
) -> Result<WatchRule, String> {
    // Validate regex if provided
    if let Some(ref pattern) = rule.regex_filter {
        if !pattern.is_empty() {
            watchlist::validate_regex(pattern)?;
        }
    }

    let mut rules = state.watch_rules.write().await;
    if let Some(existing) = rules.iter_mut().find(|r| r.id == rule.id) {
        *existing = rule.clone();
        save_rules(&app, &rules)?;
        Ok(rule)
    } else {
        Err("Rule not found".to_string())
    }
}

#[tauri::command]
pub async fn delete_watch_rule(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    // Remove the rule
    let mut rules = state.watch_rules.write().await;
    rules.retain(|r| r.id != id);
    save_rules(&app, &rules)?;

    // Clean up matches for this rule
    let mut matches = state.watch_matches.write().await;
    matches.retain(|m| m.rule_id != id);
    save_matches(&app, &matches)?;

    // Clean up seen hashes for this rule
    let mut seen = state.watch_seen.write().await;
    seen.remove(&id);
    save_seen(&app, &seen)?;

    Ok(())
}

#[tauri::command]
pub async fn get_watch_matches(
    state: State<'_, AppState>,
    rule_id: Option<String>,
) -> Result<Vec<WatchMatch>, String> {
    let matches = state.watch_matches.read().await;
    match rule_id {
        Some(id) => Ok(matches.iter().filter(|m| m.rule_id == id).cloned().collect()),
        None => Ok(matches.clone()),
    }
}

#[tauri::command]
pub async fn clear_watch_matches(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    rule_id: Option<String>,
) -> Result<(), String> {
    let mut matches = state.watch_matches.write().await;
    match rule_id {
        Some(id) => matches.retain(|m| m.rule_id != id),
        None => matches.clear(),
    }
    save_matches(&app, &matches)?;
    Ok(())
}

#[tauri::command]
pub async fn run_watch_rule_now(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<WatchMatch>, String> {
    // Placeholder — full implementation in Task 5
    Ok(vec![])
}

fn load_tracker_configs(app: &tauri::AppHandle) -> Vec<TrackerConfig> {
    let store = match app.store("settings.json") {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    match store.get("tracker_configs") {
        Some(val) => serde_json::from_value(val.clone()).unwrap_or_default(),
        None => vec![],
    }
}
```

- [ ] **Step 2: Add mod to commands/mod.rs**

In `src-tauri/src/commands/mod.rs`, add:

```rust
pub mod watchlist;
```

- [ ] **Step 3: Register commands in lib.rs**

In `src-tauri/src/lib.rs`, inside the `invoke_handler(tauri::generate_handler![...])` block, add after the rclone commands:

```rust
// Watch list
commands::watchlist::get_watch_rules,
commands::watchlist::add_watch_rule,
commands::watchlist::update_watch_rule,
commands::watchlist::delete_watch_rule,
commands::watchlist::get_watch_matches,
commands::watchlist::clear_watch_matches,
commands::watchlist::run_watch_rule_now,
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands/watchlist.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(watchlist): add Tauri command handlers for watch rule CRUD"
```

---

### Task 5: Watch loop and auto-add

**Files:**
- Modify: `src-tauri/src/watchlist.rs` (append watch loop)
- Modify: `src-tauri/src/lib.rs` (load from store + spawn loop)

- [ ] **Step 1: Add watch loop to watchlist.rs**

Append to `src-tauri/src/watchlist.rs`:

```rust
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreExt;

use crate::scrapers::{self, SearchParams, TrackerConfig};
use crate::state::AppState;

const TICK_INTERVAL_SECS: u64 = 60;
pub const MAX_MATCHES: usize = 500;
pub const MAX_SEEN_PER_RULE: usize = 5000;

pub async fn start_watch_loop(app: tauri::AppHandle, cancel: CancellationToken) {
    let mut logged_no_trackers = false;

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                log::info!("Watch loop cancelled, shutting down");
                return;
            }
            _ = tokio::time::sleep(Duration::from_secs(TICK_INTERVAL_SECS)) => {}
        }

        let state: tauri::State<'_, AppState> = app.state();

        // Load tracker configs
        let tracker_configs = load_tracker_configs(&app);
        if tracker_configs.is_empty() {
            if !logged_no_trackers {
                log::info!("Watch loop: no trackers configured, skipping");
                logged_no_trackers = true;
            }
            continue;
        }
        logged_no_trackers = false;

        // Snapshot enabled rules that are due
        let rules_snapshot: Vec<WatchRule> = {
            let rules = state.watch_rules.read().await;
            let now = chrono::Utc::now();
            rules
                .iter()
                .filter(|r| {
                    if !r.enabled {
                        return false;
                    }
                    match &r.last_checked {
                        None => true, // never checked
                        Some(ts) => {
                            if let Ok(last) = chrono::DateTime::parse_from_rfc3339(ts) {
                                let elapsed = now.signed_duration_since(last);
                                elapsed.num_minutes() >= r.interval_minutes as i64
                            } else {
                                true
                            }
                        }
                    }
                })
                .cloned()
                .collect()
        };

        for rule in &rules_snapshot {
            if cancel.is_cancelled() {
                return;
            }

            let new_matches = run_rule(&app, &state, rule, &tracker_configs).await;

            if !new_matches.is_empty() {
                // Emit event for each match
                for m in &new_matches {
                    let _ = app.emit("watchlist-match", m.clone());
                }

                // Persist new matches
                {
                    let mut matches = state.watch_matches.write().await;
                    matches.extend(new_matches.clone());
                    // Prune to MAX_MATCHES, keeping newest
                    if matches.len() > MAX_MATCHES {
                        let drain_count = matches.len() - MAX_MATCHES;
                        matches.drain(..drain_count);
                    }
                    let _ = save_to_store(&app, "watch_matches", &*matches);
                }
            }

            // Update rule's last_checked (with race condition guard)
            {
                let mut rules = state.watch_rules.write().await;
                if let Some(existing) = rules.iter_mut().find(|r| r.id == rule.id) {
                    // Only update if user hasn't modified the rule since our snapshot
                    if existing.last_checked == rule.last_checked {
                        existing.last_checked =
                            Some(chrono::Utc::now().to_rfc3339());

                        // Update TV show tracking position
                        if let RuleType::TvShow {
                            ref mut last_season,
                            ref mut last_episode,
                        } = existing.rule_type
                        {
                            for m in &new_matches {
                                if let (Some(s), Some(e)) = (m.season, m.episode) {
                                    let current = (
                                        last_season.unwrap_or(0),
                                        last_episode.unwrap_or(0),
                                    );
                                    if (s, e) > current {
                                        *last_season = Some(s);
                                        *last_episode = Some(e);
                                    }
                                }
                            }
                        }
                    }
                }
                let _ = save_to_store(&app, "watch_rules", &*rules);
            }
        }
    }
}

async fn run_rule(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, AppState>,
    rule: &WatchRule,
    tracker_configs: &[TrackerConfig],
) -> Vec<WatchMatch> {
    let params = SearchParams {
        query: rule.query.clone(),
        category: rule.category.clone(),
        sort_by: Some("seeders".to_string()),
        page: None,
    };

    let response = scrapers::search_all(&params, tracker_configs).await;

    // Get per-rule seen set
    let seen = {
        let seen_map = state.watch_seen.read().await;
        seen_map.get(&rule.id).cloned().unwrap_or_default()
    };

    let filtered = filter_results(&response.results, rule, &seen);

    let now = chrono::Utc::now().to_rfc3339();
    let mut new_matches = Vec::new();

    for result in &filtered {
        let episode_info = parse_episode(&result.title);

        let (status, action_taken) = match rule.action {
            WatchAction::Notify => (MatchStatus::Notified, WatchAction::Notify),
            WatchAction::AutoAdd => {
                match auto_add(app, state, &result.magnet).await {
                    Ok(()) => (MatchStatus::Added, WatchAction::AutoAdd),
                    Err(reason) => (MatchStatus::Failed(reason), WatchAction::AutoAdd),
                }
            }
        };

        new_matches.push(WatchMatch {
            rule_id: rule.id.clone(),
            info_hash: result.info_hash.clone(),
            magnet: result.magnet.clone(),
            title: result.title.clone(),
            size_bytes: result.size_bytes,
            matched_at: now.clone(),
            action_taken,
            status,
            season: episode_info.map(|(s, _)| s),
            episode: episode_info.map(|(_, e)| e),
        });
    }

    // Update seen hashes
    if !new_matches.is_empty() {
        let mut seen_map = state.watch_seen.write().await;
        let rule_seen = seen_map.entry(rule.id.clone()).or_default();
        for m in &new_matches {
            rule_seen.insert(m.info_hash.clone());
        }
        // Cap at MAX_SEEN_PER_RULE (keep all if under)
        if rule_seen.len() > MAX_SEEN_PER_RULE {
            let excess = rule_seen.len() - MAX_SEEN_PER_RULE;
            let to_remove: Vec<_> = rule_seen.iter().take(excess).cloned().collect();
            for h in to_remove {
                rule_seen.remove(&h);
            }
        }
        let _ = save_to_store(app, "watch_seen_hashes", &*seen_map);
    }

    new_matches
}

async fn auto_add(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, AppState>,
    magnet: &str,
) -> Result<(), String> {
    let provider = state.get_provider().await;

    // Step 1: Add magnet
    let add_response = provider
        .add_magnet(magnet)
        .await
        .map_err(|e| format!("Failed to add magnet: {}", e))?;

    // Step 2: Poll torrent_info with backoff until files are available
    let backoff_ms = [1000u64, 2000, 4000, 8000, 16000, 32000];
    let mut files_ready = false;

    for delay in &backoff_ms {
        tokio::time::sleep(Duration::from_millis(*delay)).await;
        match provider.torrent_info(&add_response.id).await {
            Ok(info) => {
                if info.status == "downloaded" || !info.files.is_empty() {
                    // Step 3: Select all files
                    let file_ids: Vec<u64> = info.files.iter().map(|f| f.id).collect();
                    if !file_ids.is_empty() {
                        if let Err(e) = provider.select_files(&add_response.id, &file_ids).await {
                            log::warn!("Watch auto-add: select_files failed: {}", e);
                        }
                    }
                    files_ready = true;
                    break;
                }
            }
            Err(e) => {
                log::warn!("Watch auto-add: torrent_info failed: {}", e);
            }
        }
    }

    if !files_ready {
        log::info!(
            "Watch auto-add: torrent {} not ready after polling, recorded as Added",
            add_response.id
        );
    }

    Ok(())
}

fn load_tracker_configs(app: &tauri::AppHandle) -> Vec<TrackerConfig> {
    let store = match app.store("settings.json") {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    match store.get("tracker_configs") {
        Some(val) => serde_json::from_value(val.clone()).unwrap_or_default(),
        None => vec![],
    }
}

fn save_to_store<T: Serialize>(
    app: &tauri::AppHandle,
    key: &str,
    value: &T,
) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let json = serde_json::to_value(value).map_err(|e| e.to_string())?;
    store.set(key, json);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Load watch data and spawn loop in lib.rs setup**

In `src-tauri/src/lib.rs`, inside the `setup()` closure, after the streaming server spawn block, add:

```rust
// Load watch list data from store and spawn watch loop
{
    let state: tauri::State<'_, AppState> = app.state();
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    // Load watch rules
    if let Some(val) = store.get("watch_rules") {
        if let Ok(rules) = serde_json::from_value::<Vec<watchlist::WatchRule>>(val.clone()) {
            *state.watch_rules.blocking_write() = rules;
        }
    }

    // Load watch matches
    if let Some(val) = store.get("watch_matches") {
        if let Ok(matches) = serde_json::from_value::<Vec<watchlist::WatchMatch>>(val.clone()) {
            *state.watch_matches.blocking_write() = matches;
        }
    }

    // Load seen hashes
    if let Some(val) = store.get("watch_seen_hashes") {
        if let Ok(seen) = serde_json::from_value::<std::collections::HashMap<String, std::collections::HashSet<String>>>(val.clone()) {
            *state.watch_seen.blocking_write() = seen;
        }
    }

    let app_handle = app.handle().clone();
    let cancel = state.watch_cancel.clone();
    tauri::async_runtime::spawn(async move {
        watchlist::start_watch_loop(app_handle, cancel).await;
    });
}
```

- [ ] **Step 3: Wire up run_watch_rule_now command**

In `src-tauri/src/commands/watchlist.rs`, replace the placeholder `run_watch_rule_now` with:

```rust
#[tauri::command]
pub async fn run_watch_rule_now(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<WatchMatch>, String> {
    let rule = {
        let rules = state.watch_rules.read().await;
        rules.iter().find(|r| r.id == id).cloned()
    };

    let rule = rule.ok_or("Rule not found")?;

    let tracker_configs = load_tracker_configs(&app);
    if tracker_configs.is_empty() {
        return Err("No trackers configured".to_string());
    }

    let new_matches = watchlist::run_rule_standalone(&app, &state, &rule, &tracker_configs).await;

    if !new_matches.is_empty() {
        // Emit events
        for m in &new_matches {
            let _ = app.emit("watchlist-match", m.clone());
        }

        // Persist matches
        let mut matches = state.watch_matches.write().await;
        matches.extend(new_matches.clone());
        if matches.len() > MAX_MATCHES {
            let drain_count = matches.len() - MAX_MATCHES;
            matches.drain(..drain_count);
        }
        save_matches(&app, &matches)?;

        // Update last_checked
        let mut rules = state.watch_rules.write().await;
        if let Some(existing) = rules.iter_mut().find(|r| r.id == id) {
            existing.last_checked = Some(chrono::Utc::now().to_rfc3339());

            if let watchlist::RuleType::TvShow {
                ref mut last_season,
                ref mut last_episode,
            } = existing.rule_type
            {
                for m in &new_matches {
                    if let (Some(s), Some(e)) = (m.season, m.episode) {
                        let current = (last_season.unwrap_or(0), last_episode.unwrap_or(0));
                        if (s, e) > current {
                            *last_season = Some(s);
                            *last_episode = Some(e);
                        }
                    }
                }
            }
        }
        save_rules(&app, &rules)?;
    }

    Ok(new_matches)
}
```

Note: `load_tracker_configs` and `TrackerConfig` are already defined/imported in this file from Task 4 Step 1.

Also in `src-tauri/src/watchlist.rs`, make `run_rule` accessible by extracting it as a public function:

```rust
/// Public entry point for running a single rule on demand (used by run_watch_rule_now command)
pub async fn run_rule_standalone(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, AppState>,
    rule: &WatchRule,
    tracker_configs: &[TrackerConfig],
) -> Vec<WatchMatch> {
    run_rule(app, state, rule, tracker_configs).await
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd src-tauri && cargo check`
Expected: Compiles with no errors. May need to adjust imports — ensure `use crate::scrapers::TrackerConfig;` is accessible from commands/watchlist.rs.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/watchlist.rs src-tauri/src/lib.rs src-tauri/src/commands/watchlist.rs
git commit -m "feat(watchlist): add watch loop with auto-add flow and store persistence"
```

---

### Task 6: TypeScript types and API layer

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/api/watchlist.ts`

- [ ] **Step 1: Add TypeScript interfaces to types/index.ts**

Append to `src/types/index.ts`:

```typescript
// ── Watch List ──

export type RuleType =
  | { type: "Keyword" }
  | { type: "TvShow"; last_season: number | null; last_episode: number | null };

export type WatchAction = "Notify" | "AutoAdd";

export type MatchStatus =
  | { type: "Notified" }
  | { type: "Added" }
  | { type: "Failed"; reason: string };

export interface WatchRule {
  id: string;
  name: string;
  rule_type: RuleType;
  query: string;
  category: string | null;
  regex_filter: string | null;
  min_seeders: number | null;
  min_size_bytes: number | null;
  max_size_bytes: number | null;
  action: WatchAction;
  interval_minutes: number;
  enabled: boolean;
  created_at: string;
  last_checked: string | null;
}

export interface WatchMatch {
  rule_id: string;
  info_hash: string;
  magnet: string;
  title: string;
  size_bytes: number;
  matched_at: string;
  action_taken: WatchAction;
  status: MatchStatus;
  season: number | null;
  episode: number | null;
}
```

- [ ] **Step 2: Create api/watchlist.ts**

Create `src/api/watchlist.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { WatchRule, WatchMatch } from "../types";

export async function getWatchRules(): Promise<WatchRule[]> {
  return invoke("get_watch_rules");
}

export async function addWatchRule(rule: WatchRule): Promise<WatchRule> {
  return invoke("add_watch_rule", { rule });
}

export async function updateWatchRule(rule: WatchRule): Promise<WatchRule> {
  return invoke("update_watch_rule", { rule });
}

export async function deleteWatchRule(id: string): Promise<void> {
  return invoke("delete_watch_rule", { id });
}

export async function getWatchMatches(ruleId?: string): Promise<WatchMatch[]> {
  return invoke("get_watch_matches", { ruleId: ruleId ?? null });
}

export async function clearWatchMatches(ruleId?: string): Promise<void> {
  return invoke("clear_watch_matches", { ruleId: ruleId ?? null });
}

export async function runWatchRuleNow(id: string): Promise<WatchMatch[]> {
  return invoke("run_watch_rule_now", { id });
}
```

- [ ] **Step 3: Verify frontend builds**

Run: `npm run build`
Expected: No TypeScript errors (types are defined but not yet consumed by any component)

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/api/watchlist.ts
git commit -m "feat(watchlist): add TypeScript types and API wrappers"
```

---

### Task 7: Sidebar update with Watch List entry

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add Watch List nav item to Sidebar**

In `src/components/Sidebar.tsx`, add the Watch List item to the `navItems` array. Insert it in the "System" section right after Search (before Settings). Add it with an eye icon SVG:

```typescript
{
  id: "watchlist",
  label: "Watch List",
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  onClick: () => onNavigate("watchlist"),
},
```

- [ ] **Step 2: Add badge support**

Add `unreadWatchCount` prop to the `SidebarProps` interface:

```typescript
interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
  onAboutOpen: () => void;
  unreadWatchCount?: number;
}
```

In the render, next to the Watch List label (similar to how the "Update" badge works for About), add:

```tsx
{item.id === "watchlist" && unreadWatchCount > 0 && (
  <span
    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
    style={{ background: "var(--accent-bg-light)", color: "var(--accent)" }}
  >
    {unreadWatchCount}
  </span>
)}
```

- [ ] **Step 3: Update Layout.tsx to pass unreadWatchCount and handle watchlist route**

In `src/components/Layout.tsx`:

Add `watchlist` to the `activeView` derivation chain (before the fallback):

```typescript
: location.pathname.startsWith("/watchlist")
? "watchlist"
```

Add state + effect for unread count:

```typescript
import { listen } from "@tauri-apps/api/event";

const [unreadWatchCount, setUnreadWatchCount] = useState(0);

// Reset unread when visiting watchlist page
useEffect(() => {
  if (activeView === "watchlist") {
    setUnreadWatchCount(0);
    localStorage.setItem("last_visited_watchlist", new Date().toISOString());
  }
}, [activeView]);

// Listen for watchlist-match events to increment badge
useEffect(() => {
  const unlisten = listen("watchlist-match", () => {
    if (activeView !== "watchlist") {
      setUnreadWatchCount((c) => c + 1);
    }
  });
  return () => { unlisten.then((fn) => fn()); };
}, [activeView]);
```

Pass to Sidebar:

```tsx
<Sidebar
  activeView={activeView}
  onNavigate={handleNavigate}
  onSearchOpen={() => navigate("/search")}
  onSettingsOpen={() => navigate("/settings")}
  onAboutOpen={() => navigate("/about")}
  unreadWatchCount={unreadWatchCount}
/>
```

- [ ] **Step 4: Verify frontend builds**

Run: `npm run build`
Expected: Compiles with no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/Layout.tsx
git commit -m "feat(watchlist): add Watch List sidebar entry with unread badge"
```

---

### Task 8: Watch List page (complete with modal)

**Files:**
- Create: `src/pages/WatchListPage.tsx`
- Modify: `src/App.tsx` (add route)

- [ ] **Step 1: Create WatchListPage.tsx with rules table**

Create `src/pages/WatchListPage.tsx` with the rules table (top panel). This includes:

- Load rules via `getWatchRules()` on mount
- Render table with columns: Name, Type badge, Query, Action badge, Interval, Last Checked, Enabled toggle
- TV rules show "S##E##" badge from `rule_type.last_season`/`last_episode`
- Row actions: Run Now button, Delete button
- "Add Rule" button (modal will be added in Task 10)
- Refresh on `watchlist-match` event

Follow the existing page patterns — use the same styling patterns as `TorrentsPage.tsx` (card-style container, table styling, badges).

```typescript
import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import * as watchlistApi from "../api/watchlist";
import type { WatchRule, WatchMatch } from "../types";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function intervalLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  return `${mins / 60}h`;
}

export default function WatchListPage() {
  const [rules, setRules] = useState<WatchRule[]>([]);
  const [matches, setMatches] = useState<WatchMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<WatchRule | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([
        watchlistApi.getWatchRules(),
        watchlistApi.getWatchMatches(),
      ]);
      setRules(r);
      setMatches(m);
    } catch (e) {
      console.error("Failed to load watch list data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh on watchlist-match events
  useEffect(() => {
    const unlisten = listen("watchlist-match", () => {
      loadData();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [loadData]);

  // Mark as visited for unread badge
  useEffect(() => {
    localStorage.setItem("last_visited_watchlist", new Date().toISOString());
  }, []);

  const handleToggle = async (rule: WatchRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    await watchlistApi.updateWatchRule(updated);
    loadData();
  };

  const handleDelete = async (id: string) => {
    await watchlistApi.deleteWatchRule(id);
    if (selectedRuleId === id) setSelectedRuleId(null);
    loadData();
  };

  const handleRunNow = async (id: string) => {
    setRunningId(id);
    try {
      await watchlistApi.runWatchRuleNow(id);
      await loadData();
    } catch (e) {
      console.error("Run failed:", e);
    } finally {
      setRunningId(null);
    }
  };

  const handleClearMatches = async () => {
    await watchlistApi.clearWatchMatches(selectedRuleId ?? undefined);
    loadData();
  };

  const filteredMatches = selectedRuleId
    ? matches.filter((m) => m.rule_id === selectedRuleId)
    : matches;

  const ruleNameMap = Object.fromEntries(rules.map((r) => [r.id, r.name]));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--theme-text-muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--theme-border-subtle)]">
        <h1 className="text-[20px] font-semibold text-[var(--theme-text-primary)]">Watch List</h1>
        <button
          onClick={() => { setEditingRule(null); setShowModal(true); }}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent)cc)" }}
        >
          Add Rule
        </button>
      </div>

      {/* Rules Table */}
      <div className="flex-1 overflow-auto px-6 py-4 min-h-0" style={{ maxHeight: "50%" }}>
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[var(--theme-text-muted)]">
            <p className="text-[15px]">No watch rules yet</p>
            <p className="text-[13px] mt-1">Create a rule to start monitoring your trackers</p>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[var(--theme-text-muted)] text-[11px] uppercase tracking-wider">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Query</th>
                <th className="pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Interval</th>
                <th className="pb-2 font-medium">Last Checked</th>
                <th className="pb-2 font-medium text-center">Enabled</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-t border-[var(--theme-border-subtle)] cursor-pointer transition-colors"
                  style={{
                    backgroundColor: selectedRuleId === rule.id ? "var(--accent-bg-light)" : "transparent",
                  }}
                  onClick={() => setSelectedRuleId(selectedRuleId === rule.id ? null : rule.id)}
                  onMouseEnter={(e) => {
                    if (selectedRuleId !== rule.id) e.currentTarget.style.backgroundColor = "var(--theme-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (selectedRuleId !== rule.id) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <td className="py-2.5 text-[var(--theme-text-primary)] font-medium">{rule.name}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      rule.rule_type.type === "TvShow"
                        ? "bg-[rgba(139,92,246,0.12)] text-[#8b5cf6]"
                        : "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]"
                    }`}>
                      {rule.rule_type.type === "TvShow" ? "TV" : "Keyword"}
                    </span>
                    {rule.rule_type.type === "TvShow" && rule.rule_type.last_season != null && (
                      <span className="ml-1.5 text-[11px] text-[var(--theme-text-muted)]">
                        S{String(rule.rule_type.last_season).padStart(2, "0")}E{String(rule.rule_type.last_episode ?? 0).padStart(2, "0")}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-[var(--theme-text-secondary)] max-w-[200px] truncate">{rule.query}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      rule.action === "AutoAdd"
                        ? "bg-[rgba(16,185,129,0.12)] text-[#10b981]"
                        : "bg-[rgba(234,179,8,0.12)] text-[#eab308]"
                    }`}>
                      {rule.action === "AutoAdd" ? "Auto-Add" : "Notify"}
                    </span>
                  </td>
                  <td className="py-2.5 text-[var(--theme-text-muted)]">{intervalLabel(rule.interval_minutes)}</td>
                  <td className="py-2.5 text-[var(--theme-text-muted)]">
                    {rule.last_checked ? formatRelativeTime(rule.last_checked) : "Never"}
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(rule); }}
                      className={`w-8 h-4.5 rounded-full transition-colors relative ${
                        rule.enabled ? "bg-[var(--accent)]" : "bg-[var(--theme-border)]"
                      }`}
                    >
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                        rule.enabled ? "translate-x-3.5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { setEditingRule(rule); setShowModal(true); }}
                        className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"
                        title="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleRunNow(rule.id)}
                        disabled={runningId === rule.id}
                        className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors disabled:opacity-50"
                        title="Run Now"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1 rounded text-[var(--theme-text-muted)] hover:text-[#ef4444] transition-colors"
                        title="Delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Matches Panel */}
      <div className="border-t border-[var(--theme-border-subtle)] flex-1 overflow-auto px-6 py-4 min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-medium text-[var(--theme-text-primary)]">
            Recent Matches
            {selectedRuleId && (
              <span className="ml-2 text-[var(--theme-text-muted)] font-normal">
                — {ruleNameMap[selectedRuleId]}
              </span>
            )}
          </h2>
          {filteredMatches.length > 0 && (
            <button
              onClick={handleClearMatches}
              className="text-[12px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {filteredMatches.length === 0 ? (
          <p className="text-[13px] text-[var(--theme-text-muted)] py-4">No matches yet</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[var(--theme-text-muted)] text-[11px] uppercase tracking-wider">
                <th className="pb-2 font-medium">Title</th>
                {!selectedRuleId && <th className="pb-2 font-medium">Rule</th>}
                <th className="pb-2 font-medium">Size</th>
                <th className="pb-2 font-medium">Matched</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {[...filteredMatches].reverse().map((m, i) => (
                <tr key={`${m.info_hash}-${i}`} className="border-t border-[var(--theme-border-subtle)]">
                  <td className="py-2 text-[var(--theme-text-primary)] max-w-[400px] truncate">{m.title}</td>
                  {!selectedRuleId && (
                    <td className="py-2 text-[var(--theme-text-muted)]">{ruleNameMap[m.rule_id] ?? "Unknown"}</td>
                  )}
                  <td className="py-2 text-[var(--theme-text-muted)]">{formatBytes(m.size_bytes)}</td>
                  <td className="py-2 text-[var(--theme-text-muted)]">{formatRelativeTime(m.matched_at)}</td>
                  <td className="py-2">
                    {m.status.type === "Notified" && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[rgba(234,179,8,0.12)] text-[#eab308]">Notified</span>
                    )}
                    {m.status.type === "Added" && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[rgba(16,185,129,0.12)] text-[#10b981]">Added</span>
                    )}
                    {m.status.type === "Failed" && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[rgba(239,68,68,0.12)] text-[#ef4444]" title={m.status.reason}>Failed</span>
                    )}
                  </td>
                  <td className="py-2">
                    {m.status.type === "Notified" && (
                      <button
                        onClick={async () => {
                          try {
                            const { addMagnet, selectTorrentFiles } = await import("../api/torrents");
                            const resp = await addMagnet(m.magnet);
                            await selectTorrentFiles(resp.id, "all").catch(() => {});
                          } catch (e) {
                            console.error("Failed to add magnet:", e);
                          }
                        }}
                        className="px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
                        style={{ background: "var(--accent-bg-light)", color: "var(--accent)" }}
                      >
                        Add
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Rule Modal */}
      {showModal && (
        <RuleModal
          rule={editingRule}
          onClose={() => { setShowModal(false); setEditingRule(null); }}
          onSave={async (rule) => {
            if (editingRule) {
              await watchlistApi.updateWatchRule(rule);
            } else {
              await watchlistApi.addWatchRule(rule);
            }
            setShowModal(false);
            setEditingRule(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
```

Note: `RuleModal` component is defined inline in the same file — see Task 9.

- [ ] **Step 2: Add route to App.tsx**

In `src/App.tsx`, add import:

```typescript
import WatchListPage from "./pages/WatchListPage";
```

Add route inside the `<Route element={<Layout />}>` block, after the search route:

```tsx
<Route path="/watchlist" element={<WatchListPage />} />
```

- [ ] **Step 3: Add watchlist to Layout.tsx activeView**

In `src/components/Layout.tsx`, update the `activeView` derivation to include watchlist. Add before the `"torrents"` fallback:

```typescript
: location.pathname.startsWith("/watchlist")
? "watchlist"
```

- [ ] **Step 4: Add RuleModal component to WatchListPage.tsx**

Add the `RuleModal` component to `src/pages/WatchListPage.tsx` (defined before the default export):

```typescript
interface RuleModalProps {
  rule: WatchRule | null;
  onClose: () => void;
  onSave: (rule: WatchRule) => Promise<void>;
}

function RuleModal({ rule, onClose, onSave }: RuleModalProps) {
  const isEdit = rule !== null;
  const [name, setName] = useState(rule?.name ?? "");
  const [ruleType, setRuleType] = useState<"Keyword" | "TvShow">(
    rule?.rule_type.type === "TvShow" ? "TvShow" : "Keyword"
  );
  const [query, setQuery] = useState(rule?.query ?? "");
  const [category, setCategory] = useState(rule?.category ?? "");
  const [action, setAction] = useState<"Notify" | "AutoAdd">(rule?.action ?? "Notify");
  const [intervalMinutes, setIntervalMinutes] = useState(rule?.interval_minutes ?? 30);
  const [regexFilter, setRegexFilter] = useState(rule?.regex_filter ?? "");
  const [minSeeders, setMinSeeders] = useState(rule?.min_seeders?.toString() ?? "");
  const [minSize, setMinSize] = useState(rule?.min_size_bytes?.toString() ?? "");
  const [maxSize, setMaxSize] = useState(rule?.max_size_bytes?.toString() ?? "");
  const [lastSeason, setLastSeason] = useState(
    rule?.rule_type.type === "TvShow" ? (rule.rule_type.last_season?.toString() ?? "") : ""
  );
  const [lastEpisode, setLastEpisode] = useState(
    rule?.rule_type.type === "TvShow" ? (rule.rule_type.last_episode?.toString() ?? "") : ""
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim() || !query.trim()) {
      setError("Name and query are required");
      return;
    }
    setSaving(true);
    setError("");

    const newRule: WatchRule = {
      id: rule?.id ?? crypto.randomUUID(),
      name: name.trim(),
      rule_type:
        ruleType === "TvShow"
          ? {
              type: "TvShow",
              last_season: lastSeason ? parseInt(lastSeason) : null,
              last_episode: lastEpisode ? parseInt(lastEpisode) : null,
            }
          : { type: "Keyword" },
      query: query.trim(),
      category: category || null,
      regex_filter: regexFilter || null,
      min_seeders: minSeeders ? parseInt(minSeeders) : null,
      min_size_bytes: minSize ? parseInt(minSize) : null,
      max_size_bytes: maxSize ? parseInt(maxSize) : null,
      action,
      interval_minutes: intervalMinutes,
      enabled: rule?.enabled ?? true,
      created_at: rule?.created_at ?? new Date().toISOString(),
      last_checked: rule?.last_checked ?? null,
    };

    try {
      await onSave(newRule);
    } catch (e: any) {
      setError(e?.toString() ?? "Failed to save");
      setSaving(false);
    }
  };

  const categories = [
    { value: "", label: "All" },
    { value: "movies", label: "Movies" },
    { value: "tv", label: "TV" },
    { value: "music", label: "Music" },
    { value: "games", label: "Games" },
    { value: "software", label: "Software" },
  ];

  const intervals = [
    { value: 15, label: "15 minutes" },
    { value: 30, label: "30 minutes" },
    { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" },
    { value: 360, label: "6 hours" },
  ];

  const inputClass = "w-full px-3 py-2 rounded-lg text-[13px] bg-[var(--theme-bg)] text-[var(--theme-text-primary)] border border-[var(--theme-border)] focus:outline-none focus:border-[var(--accent)]";
  const labelClass = "text-[12px] text-[var(--theme-text-muted)] mb-1 block";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[480px] max-h-[85vh] overflow-y-auto rounded-xl p-6"
        style={{ backgroundColor: "var(--theme-bg-surface)", border: "1px solid var(--theme-border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold text-[var(--theme-text-primary)] mb-4">
          {isEdit ? "Edit Rule" : "Add Rule"}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className={labelClass}>Name</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Watch Rule" />
          </div>

          {/* Rule Type Toggle */}
          <div>
            <label className={labelClass}>Type</label>
            <div className="flex gap-2">
              {(["Keyword", "TvShow"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setRuleType(t)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor: ruleType === t ? "var(--accent-bg-light)" : "var(--theme-bg)",
                    color: ruleType === t ? "var(--accent)" : "var(--theme-text-muted)",
                    border: `1px solid ${ruleType === t ? "var(--accent)" : "var(--theme-border)"}`,
                  }}
                >
                  {t === "TvShow" ? "TV Show" : "Keyword"}
                </button>
              ))}
            </div>
          </div>

          {/* Query */}
          <div>
            <label className={labelClass}>Search Query</label>
            <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g., Breaking Bad 2160p" />
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Category</label>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* TV Show: Season/Episode */}
          {ruleType === "TvShow" && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelClass}>Start from Season (optional)</label>
                <input className={inputClass} type="number" min="1" value={lastSeason} onChange={(e) => setLastSeason(e.target.value)} placeholder="Auto-detect" />
              </div>
              <div className="flex-1">
                <label className={labelClass}>Start from Episode (optional)</label>
                <input className={inputClass} type="number" min="0" value={lastEpisode} onChange={(e) => setLastEpisode(e.target.value)} placeholder="Auto-detect" />
              </div>
            </div>
          )}

          {/* Action Toggle */}
          <div>
            <label className={labelClass}>Action</label>
            <div className="flex gap-2">
              {(["Notify", "AutoAdd"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAction(a)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                  style={{
                    backgroundColor: action === a ? "var(--accent-bg-light)" : "var(--theme-bg)",
                    color: action === a ? "var(--accent)" : "var(--theme-text-muted)",
                    border: `1px solid ${action === a ? "var(--accent)" : "var(--theme-border)"}`,
                  }}
                >
                  {a === "AutoAdd" ? "Auto-Add" : "Notify"}
                </button>
              ))}
            </div>
          </div>

          {/* Interval */}
          <div>
            <label className={labelClass}>Check Interval</label>
            <select className={inputClass} value={intervalMinutes} onChange={(e) => setIntervalMinutes(parseInt(e.target.value))}>
              {intervals.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>

          {/* Advanced */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[12px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"
          >
            {showAdvanced ? "Hide" : "Show"} Advanced Filters
          </button>

          {showAdvanced && (
            <div className="space-y-3 pl-3 border-l-2 border-[var(--theme-border-subtle)]">
              <div>
                <label className={labelClass}>Regex Filter (applied to title)</label>
                <input className={inputClass} value={regexFilter} onChange={(e) => setRegexFilter(e.target.value)} placeholder="e.g., (2160p|4K)" />
              </div>
              <div>
                <label className={labelClass}>Min Seeders</label>
                <input className={inputClass} type="number" min="0" value={minSeeders} onChange={(e) => setMinSeeders(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className={labelClass}>Min Size (bytes)</label>
                  <input className={inputClass} type="number" min="0" value={minSize} onChange={(e) => setMinSize(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className={labelClass}>Max Size (bytes)</label>
                  <input className={inputClass} type="number" min="0" value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && <p className="text-[13px] text-[#ef4444]">{error}</p>}

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"
              style={{ background: "var(--theme-hover)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent)cc)" }}
            >
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify frontend builds**

Run: `npm run build`
Expected: Compiles with no errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/WatchListPage.tsx src/App.tsx src/components/Layout.tsx
git commit -m "feat(watchlist): add Watch List page with rules table, matches panel, and rule modal"
```

---

### Task 9: Toast notifications for watch matches

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Add toast for watchlist-match events**

In `src/components/Layout.tsx`, add a toast notification when a `watchlist-match` event fires and the user is not on the Watch List page. Use the existing `Toast` component pattern.

Import Toast and WatchMatch:

```typescript
import Toast from "./Toast";
import type { WatchMatch } from "../types";
```

Add state:

```typescript
const [watchToast, setWatchToast] = useState<string | null>(null);
```

Update the existing `watchlist-match` listener to also set the toast:

```typescript
useEffect(() => {
  const unlisten = listen<WatchMatch>("watchlist-match", (event) => {
    if (activeView !== "watchlist") {
      setUnreadWatchCount((c) => c + 1);
      const match = event.payload;
      const statusText = match.status.type === "Failed" ? " (failed)" : "";
      setWatchToast(`Watch match: ${match.title}${statusText}`);
    }
  });
  return () => { unlisten.then((fn) => fn()); };
}, [activeView]);
```

Add Toast render before closing `</DownloadTasksProvider>`:

```tsx
{watchToast && (
  <Toast
    message={watchToast}
    onDismiss={() => setWatchToast(null)}
  />
)}
```

- [ ] **Step 2: Verify frontend builds**

Run: `npm run build`
Expected: Compiles with no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat(watchlist): add toast notifications for watch list matches"
```

---

### Task 10: Full build verification

**Files:** None (verification only)

- [ ] **Step 1: Run full Rust build**

Run: `cd src-tauri && cargo build`
Expected: Compiles with no errors

- [ ] **Step 2: Run full frontend build**

Run: `npm run build`
Expected: Compiles with no errors

- [ ] **Step 3: Run Tauri dev to verify app launches**

Run: `npm run tauri dev`
Expected: App launches, Watch List appears in sidebar, clicking it shows the empty state page, "Add Rule" button opens modal. No console errors.

- [ ] **Step 4: Smoke test the flow**

1. Navigate to Watch List page
2. Click "Add Rule" — fill in name, query, select Keyword type, Notify action, 15m interval
3. Click Create — rule appears in the table
4. Click Run Now — should execute without error (results depend on tracker config)
5. Toggle enabled off/on
6. Click Delete — rule is removed
7. Verify sidebar badge and toast work by creating an AutoAdd rule

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(watchlist): address issues found during smoke testing"
```
