# Preview Video Button — Design Spec

## Overview

Add a floating mini-player to DebridDownloader that lets users quickly preview video files from the torrent list without opening the detail slide-over. The player persists across page navigation, is draggable and resizable, and leverages the existing Rust streaming backend with zero new dependencies.

## Motivation

Currently, previewing a video requires: click torrent row → open slide-over → scroll to files → click play. A preview button directly on the torrent list row with a floating mini-player reduces this to one click and lets users keep browsing while watching.

## Design

### Preview Button on Torrent List Rows

A small play icon button added to the actions column of each torrent row in the torrents table. Appears for all torrents (we don't know file contents until fetched). When clicked:

1. Fetch `TorrentInfo` via `getTorrentInfo()` from `src/api/torrents.ts` if not already loaded.
2. Identify video files by matching the file extension from `TorrentFile.path` against the known video extensions list (see Format Handling below).
3. Select the largest video file by `bytes` field.
4. Attempt to get a stream URL via the existing `get_stream_url` Tauri command.
5. If successful, open the floating mini-player.
6. If it fails (not cached/ready), show a toast: "Not available for streaming yet."
7. If no video files found, show a toast: "No video files found."

The button always calls `openPreview(torrent.id)` with no fileId — the context handles file selection internally. The optional `fileId`/`filename` params exist for future use (e.g., calling from the slide-over where files are already loaded).

The button is disabled (with a loading spinner) while fetching to prevent duplicate requests.

### Floating Mini-Player Component

A `MiniPlayer` component rendered at the app root (`App.tsx`, outside the router) so it persists across page navigation.

**Visual design:**
- Default size: 400x250px. Minimum: 320x200px.
- Initial position: bottom-right corner with padding from edges.
- Rounded corners, subtle shadow, semi-transparent dark header bar.
- Header: filename (truncated) + close button (also closeable via Escape key).
- Body: HTML5 `<video>` element with native controls (play/pause, seek, volume, fullscreen).
- Resize handle in bottom-left corner.
- Drag via header bar.
- z-index: higher than page content and the slide-over panel, but below toast notifications so error/status toasts remain visible.

**Drag/resize implementation:**
- `onPointerDown` / `onPointerMove` / `onPointerUp` handlers.
- Constrain position within app window bounds.
- Position and size stored as component-local state in `MiniPlayer.tsx` (not in context — only `MiniPlayer` needs them). Not persisted across sessions.
- Window `resize` event listener re-clamps position. If the window shrinks smaller than the player's current size, the player clamps to the window edges (may overflow slightly rather than being hidden).

**Format handling:**

Video files are identified by matching the file extension from `TorrentFile.path` (torrent content paths, not local filesystem paths). Extensions are checked case-insensitively.

- Inline-playable: `.mp4`, `.webm`, `.mov`, `.m4v`.
- Non-playable video: `.mkv`, `.avi`, `.wmv`, `.flv`, `.ts` (MPEG transport stream — not TypeScript files; this check runs against torrent file paths only).
- All of the above are considered "video" when selecting the largest file.
- Non-playable formats: Show fallback UI in the player body with "Open in External Player" button.
- On `<video>` error event: Same fallback UI.
- "Open in External Player" uses `open()` from `@tauri-apps/plugin-opener` to pass the stream URL to the OS default handler (same approach as the existing external player flow in `TorrentsPage.tsx`).

**Keyboard accessibility:**
- Escape key closes the mini-player.
- Native `<video>` controls handle spacebar (play/pause), arrow keys (seek), etc.

**Lifecycle:**
- Opening a new preview cleans up the old session first (`cleanup_stream_session`), then replaces with the new stream.
- Close button calls `cleanup_stream_session`.
- Page navigation does NOT close the player.

### State Management

A `MiniPlayerContext` using React Context.

**State (in context):**
- `isOpen: boolean`
- `streamUrl: string | null`
- `sessionId: string | null`
- `filename: string`
- `isLoading: boolean`
- `torrentId: string | null` (stored for retry)
- `fileId: number | null` (stored for retry)

Position and size are component-local state in `MiniPlayer.tsx`, not in context.

**Actions:**
- `openPreview(torrentId: string, fileId?: number, filename?: string)` — If no `fileId`, fetches torrent info via `getTorrentInfo()` and picks the largest video file. Gets stream URL, opens player.
- `closePreview()` — Cleans up stream session, resets state.

**Provider placement:** Wraps the entire app in `App.tsx`.

**Custom hook:** `useMiniPlayer()` exposes `openPreview`, `closePreview`, `isOpen`, `isLoading`.

### Error Handling

- **Torrent not cached/ready:** `get_stream_url` returns an error. Show toast notification, player doesn't open.
- **Stream URL expires mid-playback:** Detected via the `<video>` element's `onerror` event. Old session is cleaned up, then a retry button appears in the player. Clicking retry re-fetches a stream URL using the stored `torrentId` and `fileId`. Playback restarts from the beginning (no resume — keeping it simple).
- **No video files:** Toast notification after fetching torrent info.
- **Rapid clicking:** `isLoading` disables the button.
- **Window resize:** `resize` event listener clamps player position to stay within visible bounds.

## What Changes

### New files:
- `src/contexts/MiniPlayerContext.tsx` — Context provider, state, actions, `useMiniPlayer` hook
- `src/components/MiniPlayer.tsx` — Floating draggable/resizable video player

### Modified files:
- `src/App.tsx` — Wrap with `MiniPlayerContext.Provider`, render `<MiniPlayer />` at root
- `src/pages/TorrentsPage.tsx` — Add preview button to torrent list row actions

### Referenced (no changes):
- `src/api/streaming.ts` — `getStreamUrl()`, `cleanupStreamSession()` used as-is
- `src/api/torrents.ts` — `getTorrentInfo()` used as-is
- `@tauri-apps/plugin-opener` — `open()` used for external player fallback
- All Rust backend code — no changes
- No new dependencies

## Estimated Size

~300-400 lines of new TypeScript/React code.
