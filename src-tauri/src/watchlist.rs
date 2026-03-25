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
            if r.info_hash.is_empty() {
                return false;
            }
            if seen.contains(&r.info_hash) {
                return false;
            }
            if let Some(ref re) = regex {
                if !re.is_match(&r.title) {
                    return false;
                }
            }
            if let Some(min) = rule.min_seeders {
                if r.seeders < min {
                    return false;
                }
            }
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
            if let RuleType::TvShow {
                last_season,
                last_episode,
            } = &rule.rule_type
            {
                match parse_episode(&r.title) {
                    None => return false,
                    Some((s, e)) => {
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
