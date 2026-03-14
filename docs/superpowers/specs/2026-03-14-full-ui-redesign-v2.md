# Full UI Redesign v2 — Design Spec

## Overview

Complete UI overhaul: new layout structure (icon rail + master-detail split), new visual identity (Noir + Emerald), UX rethink (command palette search, merged views, killed dead pages). Every frontend file gets rewritten. Backend unchanged.

---

## Layout Structure

### Icon Rail (48px wide)

- Fixed left rail, full height
- Background: `#06060b`, right border `rgba(255,255,255,0.04)`
- **Top:** App logo (28x28 emerald rounded square with white "D")
- **Middle:** View icons, vertically stacked with 6px gap:
  1. Torrents (download icon) — route `/torrents`
  2. Downloads (inbox icon) — route `/downloads`
  3. Search trigger (magnifier icon) — opens command palette, NOT a route
  4. Settings (gear icon) — opens settings modal, NOT a route
- **Bottom:** User avatar (28x28 circle, emerald initials fallback). Click avatar opens a small popover with username, premium expiry, and a **Logout** button
- Active view icon: `rgba(16,185,129,0.08)` background, `#10b981` icon color
- Inactive: `#374151` icon color, hover `rgba(255,255,255,0.04)` background
- Icon size: 18px stroke icons
- Tooltip on hover showing label (e.g., "Torrents", "Downloads")

### Main Area: Master-Detail Split

**List Panel (left, default ~55% width):**
- Background: `#08080f`
- Top section: panel header with view title + action buttons (e.g., "Add Torrent", "Refresh")
- Content: scrollable list of compact rows (44px height each)
- List item layout: 6px status dot · filename (500 weight) · right-aligned size + status badge
- Selected item: 2px emerald left border, `rgba(16,185,129,0.04)` background tint
- Active downloads: 2px progress bar below filename within the row
- Right-click context menu on items: Download (if no folder configured, prompt with native folder picker), Delete (with confirmation), Copy Magnet (construct URI from `torrent.hash` as `magnet:?xt=urn:btih:{hash}`)

**Detail Panel (right, default ~45% width):**
- Background: `#0c0c16`
- When item selected: shows item details (files list, hash, status, dates, action buttons)
- When nothing selected: shows **stats dashboard**
- Separator between panels: 1px `rgba(255,255,255,0.04)` border, draggable to resize. Panel width ratio persisted to `localStorage` (key: `panel-split-ratio`)

**Stats Dashboard (detail panel default state):**
- Grid of stat cards:
  - Active downloads count + aggregate speed (from `getDownloadTasks()` polling)
  - Completed this session (client-side counter, incremented when a download status changes to "Completed" — no backend timestamp needed, resets on app restart)
  - Premium days remaining (calculated from `user.expiration`)
  - Download folder path (from settings, or "Not set" if null)
- Mini progress bars for any active downloads
- Keyboard shortcut reference at bottom (subtle, `#374151` text)
- Note: disk space was considered but requires a new backend command — out of scope for this redesign. Show download folder path instead

### Views

**Torrents View (icon rail item 1):**
- List panel: RD torrent list (all statuses mixed)
- Detail panel on select: torrent info — filename, hash, status, progress, seeders, added date, file list with checkboxes, Download/Delete buttons
- Header actions: "+ Add" button (opens AddTorrentModal), Refresh button

**Downloads View (icon rail item 2):**
- List panel: active + completed + failed file downloads
- Detail panel on select: download progress, speed, ETA, destination path (from `task.destination` field — this is the full file path including filename), Cancel button
- Header actions: "Clear Completed" button

### Killed Pages

- **History page** — removed entirely. The RD download history is low-value noise
- **Settings page** — becomes a modal overlay
- **Search page** — becomes ⌘K command palette

---

## Command Palette (⌘K)

**Trigger:** `⌘K` keyboard shortcut OR clicking the search icon in the rail.

**Appearance:**
- Centered floating overlay, 560px wide, max-height 420px
- Background: `#0f0f18`, border `rgba(255,255,255,0.06)`, border-radius 12px
- Backdrop: `rgba(0,0,0,0.6)` with `backdrop-filter: blur(8px)`
- Entry animation: fade in + scale from 0.98 (150ms)

**Input:**
- Full-width input at top, no border, large text (15px)
- Placeholder: "Search torrents or paste magnet..."
- Auto-focused on open

**Modes (toggle via Tab key or clickable tabs):**
1. **Search Trackers** (default) — queries 1337x and TPB scrapers (existing backend). Results show: title, size, seeders/leechers, source badge. Click or Enter on result = `addMagnet(result.magnet)` then `selectTorrentFiles(id, "all")`. The RD API accepts the literal string `"all"` as the files parameter — this pattern is already used in `AddTorrentModal.tsx`. Shows "Added!" confirmation inline.
2. **My Torrents** — instant client-side filter of existing torrent list by filename. Click to select in the main list and close palette.

**Behavior:**
- Search debounced at 300ms for tracker search, instant for local filter
- `Esc` closes palette
- `↑↓` arrow keys navigate results
- `Enter` on search result adds it; on local result selects it
- Paste detection: if text starts with `magnet:?`, auto-trigger add magnet flow
- Loading state: skeleton lines while trackers respond
- Tracker failure: subtle inline warning "1337x unavailable" but still show other tracker results

---

## Settings Modal

**Trigger:** Clicking gear icon in rail.

**Appearance:**
- Centered modal, 440px wide
- Same dark card styling as command palette
- Title: "Settings" (14px, 600 weight)

**Contents (3 settings only):**
1. **Download folder** — path display + "Browse" button (opens native folder picker)
2. **Max concurrent downloads** — dropdown (1, 2, 3, 4, 5, 8, 10)
3. **Create subfolders per torrent** — toggle switch

**Behavior:**
- Auto-save on every change (no save button). Brief emerald checkmark flash as confirmation
- `Esc` closes modal

---

## Visual Design System

### Colors

```
Background:     #08080f (main), #06060b (rail), #0c0c16 (detail panel)
Surfaces:       #0f0f18
Borders:        rgba(255,255,255,0.04) default, rgba(255,255,255,0.06) hover
Accent:         #10b981 (emerald) — primary actions, active states, progress
Accent hover:   #34d399
Text primary:   #f1f5f9
Text secondary: #94a3b8
Text muted:     #475569
Text ghost:     #374151

Status ready:   #10b981 (emerald)
Status active:  #3b82f6 (blue)
Status queued:  #eab308 (amber)
Status error:   #ef4444 (red)
```

### Typography

- Font: system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", ...`)
- Letter-spacing: `-0.2px` on headings, `-0.1px` on body
- Sizes: 13px body, 11px metadata/secondary, 14px panel headers, 15px command palette input
- Weights: 400 body, 500 filenames/labels, 600 panel headers. NO 700/bold except logo
- NO font sizes above 14px anywhere except command palette input. This is a utility app

### Borders & Radius

- Border radius: 8px cards/panels, 6px buttons/inputs, 4px badges/pills, 12px command palette
- Borders: `rgba(255,255,255,0.04)` default
- Selected/active borders: `rgba(16,185,129,0.15)`

### Shadows & Depth

- Rail only: `0 1px 2px rgba(0,0,0,0.4)`
- Command palette: `0 8px 32px rgba(0,0,0,0.5)`
- Everything else: NO shadows. Depth via color differences only

### Motion

- All transitions: `150ms ease`. No spring, no bounce
- Hover: background change `rgba(255,255,255,0.03)` only
- Command palette: fade+scale entry 150ms
- Modal: fade+slide-up 200ms

### Progress Bars

- Height: 2px inline (in list rows), 3px in detail panel
- Track: `rgba(16,185,129,0.08)` (emerald) or `rgba(59,130,246,0.08)` (blue)
- Fill: `#10b981` for complete, `#3b82f6` for downloading
- No gradients on progress bars. Solid color fills

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` | Open command palette |
| `⌘R` | Refresh torrent list |
| `Delete` / `Backspace` | Delete selected torrent (with confirmation) |
| `↑` / `↓` | Navigate list |
| `Enter` | Download selected / confirm action |
| `Esc` | Close palette / modal / deselect |

Shortcuts registered via `useEffect` with `keydown` listeners on the window. Both `⌘K` and `⌘R` must call `preventDefault()` to avoid browser/webview default behavior (⌘K = browser search, ⌘R = page reload in Tauri webview).

---

## Auth Page

- Full-screen centered card on `#08080f` background
- Card: `#0f0f18`, `rgba(255,255,255,0.04)` border, 12px radius
- Logo: emerald "D" square + "DebridDownloader" text (14px, 600 weight)
- Same dual-mode (API token / OAuth) toggle — restyled with emerald accent
- Input focus: border changes to `rgba(16,185,129,0.3)`
- Button: solid `#10b981`, hover `#34d399`

---

## File Structure Changes

**New files:**
- `src/components/IconRail.tsx` — the 48px left rail
- `src/components/MasterDetail.tsx` — split panel container (resizable)
- `src/components/StatsDashboard.tsx` — default detail panel content
- `src/components/CommandPalette.tsx` — ⌘K search overlay
- `src/components/SettingsModal.tsx` — settings as modal

**Rewritten files:**
- `src/styles/index.css` — completely new design tokens and utilities
- `src/components/Layout.tsx` — new layout with icon rail + master-detail
- `src/pages/TorrentsPage.tsx` — list+detail view for torrents
- `src/pages/DownloadsPage.tsx` — list+detail view for downloads
- `src/pages/AuthPage.tsx` — restyled auth
- `src/components/AddTorrentModal.tsx` — restyled
- `src/components/TorrentDetail.tsx` — becomes the detail panel content (not a modal). New prop contract: `{ torrentId: string; onRefresh: () => void }`. No `onClose` — deselecting in the list clears the detail panel. The parent (`TorrentsPage`) manages which torrent is selected and passes the ID down
- `src/App.tsx` — simplified routing (only `/torrents`, `/downloads`, `/auth`). All other paths (`/search`, `/history`, `/settings`, `*`) redirect to `/torrents`. The `AppSettings.theme` field is preserved as-is in the types — the SettingsModal reads and writes the full `AppSettings` object, just doesn't render a theme picker

**Deleted files:**
- `src/pages/SearchPage.tsx` — replaced by CommandPalette
- `src/pages/HistoryPage.tsx` — removed
- `src/pages/SettingsPage.tsx` — replaced by SettingsModal

**Unchanged:**
- All `src/api/` files (auth, torrents, downloads, search, settings)
- All `src/types/` files
- All `src/hooks/` files
- All `src-tauri/` backend code
- `src/utils.ts`

---

## What's NOT in Scope

- Backend changes (scrapers, API, commands — all stay as-is)
- New features beyond what's described (no watch folders, no auto-download, no notifications)
- Drag-and-drop .torrent file upload
- Light theme
- Resizable rail width
