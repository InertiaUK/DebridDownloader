//! Post-download archive extraction: classify completed files into
//! ArchiveGroups, dispatch to the right backend, surface typed errors.

use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveKind {
    Zip,
    Rar,
    SevenZip,
    TarGz,
    TarXz,
    TarBz2,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveGroup {
    pub kind: ArchiveKind,
    pub primary: PathBuf,
    pub all_parts: Vec<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RarTool {
    SevenZip,  // `7z`
    SevenZz,   // `7zz`
    Unar,
    Unrar,
    None,
}

impl RarTool {
    pub fn name(self) -> Option<&'static str> {
        match self {
            RarTool::SevenZip => Some("7z"),
            RarTool::SevenZz => Some("7zz"),
            RarTool::Unar => Some("unar"),
            RarTool::Unrar => Some("unrar"),
            RarTool::None => Option::None,
        }
    }
}

#[derive(Debug)]
pub enum ExtractError {
    UnsupportedFormat,
    RarToolMissing,
    ToolFailed { tool: String, stderr: String },
    Io(std::io::Error),
    BadArchive(String),
    PasswordRequired,
}

impl std::fmt::Display for ExtractError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExtractError::UnsupportedFormat => write!(f, "Unsupported archive format"),
            ExtractError::RarToolMissing => write!(
                f,
                "Install 7-Zip, p7zip, or unar to extract RAR archives"
            ),
            ExtractError::ToolFailed { tool, stderr } => {
                write!(f, "Extract failed ({}): {}", tool, stderr)
            }
            ExtractError::Io(e) => write!(f, "Extract IO error: {}", e),
            ExtractError::BadArchive(msg) => write!(f, "Archive corrupt: {}", msg),
            ExtractError::PasswordRequired => write!(
                f,
                "Archive is password-protected (not supported in v1)"
            ),
        }
    }
}

impl std::error::Error for ExtractError {}

pub fn classify(_completed: &Path, _siblings: &[&Path]) -> Option<ArchiveGroup> {
    Option::None  // filled in by Task 3
}

pub fn detect_rar_tool() -> RarTool {
    RarTool::None  // filled in by Task 4
}

pub fn count_videos(_dir: &Path) -> usize {
    0  // filled in by Task 5
}
