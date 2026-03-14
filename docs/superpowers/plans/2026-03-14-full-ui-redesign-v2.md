# Full UI Redesign v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely rebuild the frontend with a 48px icon rail, master-detail split panels, noir+emerald visual identity, ⌘K command palette for search, and settings as a modal — killing the History, Settings, and Search pages.

**Architecture:** The icon rail replaces the sidebar. Layout.tsx composes IconRail + a routed main area. TorrentsPage and DownloadsPage each render their own list+detail split using a shared MasterDetail component. CommandPalette is a global overlay triggered by ⌘K. All existing backend code, API wrappers, hooks, and types are unchanged.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Tauri v2 (invoke IPC), React Router v7

**Spec:** `docs/superpowers/specs/2026-03-14-full-ui-redesign-v2.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/styles/index.css` | Rewrite | New design tokens (noir+emerald), reset, scrollbar, checkbox, utilities |
| `src/components/IconRail.tsx` | Create | 48px left rail: logo, view icons, search/settings triggers, avatar popover |
| `src/components/MasterDetail.tsx` | Create | Resizable split panel container with localStorage persistence |
| `src/components/StatsDashboard.tsx` | Create | Default detail panel: stat cards, active downloads, shortcuts |
| `src/components/CommandPalette.tsx` | Create | ⌘K overlay: search trackers, filter local torrents, paste magnet |
| `src/components/SettingsModal.tsx` | Create | Settings overlay: folder, concurrency, subfolders (auto-save) |
| `src/components/Layout.tsx` | Rewrite | Compose IconRail + Outlet, global keyboard shortcuts |
| `src/components/TorrentDetail.tsx` | Rewrite | Inline detail panel (not modal), new props `{torrentId, onRefresh}` |
| `src/components/AddTorrentModal.tsx` | Rewrite | Restyled with noir+emerald |
| `src/pages/TorrentsPage.tsx` | Rewrite | List panel + TorrentDetail in MasterDetail, context menu |
| `src/pages/DownloadsPage.tsx` | Rewrite | List panel + download detail in MasterDetail |
| `src/pages/AuthPage.tsx` | Rewrite | Restyled with noir+emerald |
| `src/App.tsx` | Rewrite | Simplified routing, remove dead imports |
| `src/pages/SearchPage.tsx` | Delete | Replaced by CommandPalette |
| `src/pages/HistoryPage.tsx` | Delete | Removed |
| `src/pages/SettingsPage.tsx` | Delete | Replaced by SettingsModal |

---

## Chunk 1: Design System + Foundation Components

### Task 1: Rewrite CSS Design System

**Files:**
- Rewrite: `src/styles/index.css`

- [ ] **Step 1: Replace the entire file with the new noir+emerald design system**

The new `index.css` must contain:
- Tailwind v4 import
- `@theme` block with ALL new color tokens: backgrounds (`#08080f`, `#06060b`, `#0c0c16`), surfaces (`#0f0f18`), emerald accent (`#10b981`, hover `#34d399`), status colors (blue `#3b82f6`, amber `#eab308`, red `#ef4444`), text colors (primary `#f1f5f9`, secondary `#94a3b8`, muted `#475569`, ghost `#374151`), border values (default `rgba(255,255,255,0.04)`, hover `rgba(255,255,255,0.06)`, active `rgba(16,185,129,0.15)`)
- Global reset (`* { margin:0; padding:0; box-sizing:border-box; }`)
- Body: `background: #08080f; color: #f1f5f9; font-family: -apple-system,...; letter-spacing: -0.1px; font-size: 13px;`
- Scrollbar styling (6px, transparent track, `#1e293b` thumb)
- Custom checkbox (emerald checked state `#10b981`)
- Select dropdown arrow styling
- NO utility classes like `.card-base`, `.skeleton`, `.modal-backdrop` etc — these are being removed. All styling will be done inline with Tailwind classes. Only keep the keyframe animations:
  - `@keyframes fade-in` (opacity 0→1, 150ms)
  - `@keyframes slide-up` (opacity 0, translateY(8px) scale(0.98) → normal, 200ms)
  - `@keyframes shimmer` (background-position slide for skeleton loading)

- [ ] **Step 2: Verify build**

Run: `cd /Volumes/DATA/VibeCoding/DebridDownloader && npm run build`
Expected: Build succeeds (pages will look broken — that's fine, they'll be rewritten).

- [ ] **Step 3: Commit**

```bash
git add src/styles/index.css
git commit -m "feat: rewrite design system with noir+emerald tokens"
```

---

### Task 2: Create MasterDetail Split Panel

**Files:**
- Create: `src/components/MasterDetail.tsx`

- [ ] **Step 1: Create the resizable split panel component**

Props: `{ listPanel: ReactNode; detailPanel: ReactNode; defaultRatio?: number }`

The component renders two side-by-side panels with a draggable separator between them. Width ratio is persisted to `localStorage` key `panel-split-ratio`. Default ratio is 0.55 (55% list, 45% detail).

Implementation notes:
- Use `useRef` for the container, `useState` for the ratio, `useEffect` to load/save from localStorage
- Drag handler: `onMouseDown` on the separator starts tracking, `mousemove` on document updates the ratio, `mouseup` stops and saves to localStorage
- Separator: 1px wide `rgba(255,255,255,0.04)` border, `cursor: col-resize`, 8px hit area (4px padding each side, transparent)
- List panel: `overflow-y: auto`, background `#08080f`
- Detail panel: `overflow-y: auto`, background `#0c0c16`
- Both panels `min-width: 280px` to prevent collapse

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/MasterDetail.tsx
git commit -m "feat: create MasterDetail resizable split panel component"
```

---

### Task 3: Create IconRail

**Files:**
- Create: `src/components/IconRail.tsx`

- [ ] **Step 1: Create the 48px icon rail component**

Props: `{ activeView: string; onViewChange: (view: string) => void; onSearchOpen: () => void; onSettingsOpen: () => void }`

The component needs access to `useAuth()` for the user avatar and logout.

Structure:
- `aside` element, 48px wide, full height, `bg-[#06060b]`, `border-r border-[rgba(255,255,255,0.04)]`, `shadow-[0_1px_2px_rgba(0,0,0,0.4)]`
- Flex column layout with `items-center`
- **Top section:** Logo — 28x28 rounded-lg square with `bg-[#10b981]`, white bold "D" text
- **Middle section (flex-1):** View icons stacked vertically with 6px gap
  - Each icon: 36x36 rounded-lg, centered. Active: `bg-[rgba(16,185,129,0.08)] text-[#10b981]`, inactive: `text-[#374151] hover:bg-[rgba(255,255,255,0.04)]`
  - Icon 1: Torrents (download SVG) — calls `onViewChange("torrents")`
  - Icon 2: Downloads (inbox SVG) — calls `onViewChange("downloads")`
  - Icon 3: Search (magnifier SVG) — calls `onSearchOpen()`
  - Icon 4: Settings (gear SVG) — calls `onSettingsOpen()`
  - Each icon has a `title` attribute for native tooltip
- **Bottom section:** User avatar
  - 28x28 circle. If `user.avatar` exists, show `<img>`. Otherwise emerald initials circle (`bg-[rgba(16,185,129,0.15)] text-[#10b981]`)
  - `onClick` toggles a popover (simple `useState<boolean>`)
  - Popover: positioned above the avatar, `bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-lg p-3`, shows username, "Premium until {date}", and a Logout button (`text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)]`)
  - Click outside closes popover

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/IconRail.tsx
git commit -m "feat: create IconRail with view switching, search/settings triggers, avatar popover"
```

---

### Task 4: Create StatsDashboard

**Files:**
- Create: `src/components/StatsDashboard.tsx`

- [ ] **Step 1: Create the stats dashboard component**

Props: `{ user: User | null; downloadTasks: DownloadTask[]; settings: AppSettings | null; completedCount: number }`

Import `{ formatSpeed }` from `../utils`.

Renders inside the detail panel when no item is selected.

Layout:
- 2x2 grid of stat cards, each card: `bg-[#0f0f18] border border-[rgba(255,255,255,0.04)] rounded-lg p-4`
  1. **Active Downloads** — count of tasks with status "Downloading" or "Pending", plus aggregate speed (sum of `task.speed` for downloading tasks, formatted with `formatSpeed()`)
  2. **Completed (Session)** — accepts a `completedCount: number` prop (parent tracks this). Display the count
  3. **Premium** — days remaining calculated from `user.expiration`: `Math.ceil((new Date(user.expiration).getTime() - Date.now()) / 86400000)`. Show as "X days" in emerald if > 30, amber if ≤ 30, red if ≤ 7
  4. **Download Folder** — from `settings.download_folder`, or "Not set" in muted text if null. Truncate long paths
- Label: 11px, `text-[#475569]`, uppercase, `tracking-wider`
- Value: 14px (the one exception — panel headers are allowed at 14px), `text-[#f1f5f9]`, 600 weight

Below the grid:
- If there are active downloads, show mini progress bars (each: filename truncated, 2px progress bar with `bg-[#3b82f6]` fill on `bg-[rgba(59,130,246,0.08)]` track)
- At bottom: keyboard shortcuts reference in `text-[#374151]` at 11px: `⌘K Search · ⌘R Refresh · ↑↓ Navigate · Enter Download`

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/StatsDashboard.tsx
git commit -m "feat: create StatsDashboard with stat cards and active downloads"
```

---

## Chunk 2: Layout, Auth, Routing

### Task 5: Rewrite Layout.tsx

**Files:**
- Rewrite: `src/components/Layout.tsx`

- [ ] **Step 1: Rewrite Layout with IconRail + global keyboard shortcuts**

The new Layout composes:
- `IconRail` on the left
- `<Outlet />` for the main content area on the right
- `CommandPalette` overlay (global, rendered here)
- `SettingsModal` overlay (global, rendered here)

State management:
- `const [showSearch, setShowSearch] = useState(false)` — command palette visibility
- `const [showSettings, setShowSettings] = useState(false)` — settings modal visibility
- `const navigate = useNavigate()` — for view switching from IconRail
- `const location = useLocation()` — to determine active view

Determine `activeView` from `location.pathname`: `/torrents` → `"torrents"`, `/downloads` → `"downloads"`, else `"torrents"`

IconRail callbacks:
- `onViewChange`: `navigate("/" + view)`
- `onSearchOpen`: `setShowSearch(true)`
- `onSettingsOpen`: `setShowSettings(true)`

Global keyboard shortcuts (in a `useEffect` with `keydown` listener):
- `⌘K` (metaKey + k): `preventDefault()`, toggle `showSearch`
- `⌘R` (metaKey + r): `preventDefault()`, dispatch a custom event `window.dispatchEvent(new Event("refresh-list"))` that the active page listens to
- `Esc`: close search or settings if open; if neither is open, dispatch `window.dispatchEvent(new Event("deselect-item"))` (pages listen for this to clear `selectedId`)
- `Delete` or `Backspace`: dispatch `window.dispatchEvent(new Event("delete-selected"))` (TorrentsPage listens and calls `handleDelete` with confirmation via `window.confirm()`)
- `Enter`: dispatch `window.dispatchEvent(new Event("action-selected"))` (TorrentsPage listens and triggers download on the selected torrent)

Layout JSX structure:
```tsx
<div className="flex h-screen overflow-hidden bg-[#08080f]">
  <IconRail ... />
  <main className="flex-1 overflow-hidden">
    <Outlet />
  </main>
  {showSearch && <CommandPalette onClose={() => setShowSearch(false)} ... />}
  {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
</div>
```

Note: `CommandPalette` and `SettingsModal` don't exist yet — import them but they'll be created in later tasks. For now, create stub components that just render `null` so the build passes:

Create temporary `src/components/CommandPalette.tsx`:
```tsx
export default function CommandPalette({ onClose }: { onClose: () => void }) { return null; }
```

Create temporary `src/components/SettingsModal.tsx`:
```tsx
export default function SettingsModal({ onClose }: { onClose: () => void }) { return null; }
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx src/components/CommandPalette.tsx src/components/SettingsModal.tsx
git commit -m "feat: rewrite Layout with IconRail, keyboard shortcuts, overlay stubs"
```

---

### Task 6: Rewrite App.tsx + Delete Dead Pages

**Files:**
- Rewrite: `src/App.tsx`
- Delete: `src/pages/SearchPage.tsx`
- Delete: `src/pages/HistoryPage.tsx`
- Delete: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Rewrite App.tsx with simplified routing**

Remove imports for `SearchPage`, `HistoryPage`, `SettingsPage`. Keep imports for `Layout`, `AuthPage`, `TorrentsPage`, `DownloadsPage`.

Routes (authenticated):
```tsx
<Route element={<Layout />}>
  <Route path="/torrents" element={<TorrentsPage />} />
  <Route path="/downloads" element={<DownloadsPage />} />
  <Route path="*" element={<Navigate to="/torrents" replace />} />
</Route>
```

The `*` catch-all handles `/search`, `/history`, `/settings`, and any other path — all redirect to `/torrents`.

Everything else in App.tsx (auth state, login/logout/OAuth logic, AuthContext.Provider) stays the same.

- [ ] **Step 2: Delete the three dead page files**

```bash
rm src/pages/SearchPage.tsx src/pages/HistoryPage.tsx src/pages/SettingsPage.tsx
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx && git rm src/pages/SearchPage.tsx src/pages/HistoryPage.tsx src/pages/SettingsPage.tsx
git commit -m "feat: simplify routing, remove History/Settings/Search pages"
```

---

### Task 7: Rewrite AuthPage

**Files:**
- Rewrite: `src/pages/AuthPage.tsx`

- [ ] **Step 1: Restyle the auth page with noir+emerald**

Keep all existing logic (token login, OAuth flow, state management). Only change the JSX/styling:

- Outer: `bg-[#08080f]` full screen centered
- Card: `bg-[#0f0f18] border border-[rgba(255,255,255,0.04)] rounded-xl` max-w-md, `p-8`
- Logo area: 28x28 emerald square with "D" + "DebridDownloader" in `text-[14px] font-semibold text-[#f1f5f9]`
- Mode toggle: pill buttons with emerald active state (`bg-[rgba(16,185,129,0.12)] text-[#10b981] border border-[rgba(16,185,129,0.2)]`)
- Inputs: `bg-[#08080f] border border-[rgba(255,255,255,0.06)] rounded-md text-[13px] text-[#f1f5f9] focus:border-[rgba(16,185,129,0.3)]` with transition 150ms
- Buttons: `bg-[#10b981] hover:bg-[#34d399] text-white font-medium rounded-md` (not black text — white on emerald for this theme)
- Error text: `text-[#ef4444]`
- OAuth user code: `text-[#10b981] text-2xl font-mono tracking-widest`

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/pages/AuthPage.tsx
git commit -m "feat: restyle auth page with noir+emerald theme"
```

---

## Chunk 3: Torrent + Download Views (Master-Detail)

### Task 8: Rewrite TorrentsPage with Master-Detail

**Files:**
- Rewrite: `src/pages/TorrentsPage.tsx`
- Rewrite: `src/components/TorrentDetail.tsx`

- [ ] **Step 1: Rewrite TorrentDetail as an inline panel (not modal)**

New props: `{ torrentId: string; onRefresh: () => void }`

Remove: modal backdrop, `onClose` prop, close button, the `fixed inset-0` wrapper. Remove ALL calls to `onClose()` — in `handleSelectFiles()` (line 52), `handleDownload()` (line 69), the backdrop onClick, and the Close button. After selecting files or downloading, the component now just calls `onRefresh()` instead of closing — the parent controls visibility by setting `selectedId` to null if needed.

The component renders directly inside the detail panel. It fetches torrent info via `getTorrentInfo(torrentId)` (same as before), shows:
- Filename as header (14px, 600 weight, `text-[#f1f5f9]`, `tracking-[-0.2px]`)
- Status badge (colored pill: emerald/blue/amber/red)
- Info grid (2 columns): Hash (mono, truncated), Added date, Size, Progress (if < 100%), Speed (if active), Seeders
- Each grid cell: `bg-[#0f0f18] rounded-md p-3`, label in 11px `text-[#475569]` uppercase, value in 13px `text-[#f1f5f9]`
- File list with checkboxes (same logic as before for file selection)
- Action buttons at bottom: Download (emerald), Delete (red text, transparent bg), Select Files (if `waiting_files_selection` status)

All styled with noir+emerald tokens. No shadows, 8px radius on cards, 6px on buttons.

- [ ] **Step 2: Rewrite TorrentsPage with list panel + detail panel**

State: `selectedId` (replaces `detailId`), `torrents`, `loading`, `error`, `showAdd`. **Remove the entire multi-select system:** delete `selected: Set<string>` state, `toggleSelect()`, `selectAll()`, `handleDownloadSelected()`, `handleDownloadAll()`, `readyTorrents`, and the "Action bar" JSX block. The new design uses single-select only — click a torrent to see its detail, download from the detail panel. No checkboxes, no batch actions.

Listen for `refresh-list` custom event (from Layout's ⌘R shortcut):
```tsx
useEffect(() => {
  const handler = () => fetchTorrents();
  window.addEventListener("refresh-list", handler);
  return () => window.removeEventListener("refresh-list", handler);
}, [fetchTorrents]);
```

Use MasterDetail component:
```tsx
<MasterDetail
  listPanel={<TorrentListPanel ... />}
  detailPanel={
    selectedId
      ? <TorrentDetail torrentId={selectedId} onRefresh={fetchTorrents} />
      : <StatsDashboard user={user} downloadTasks={[]} settings={settings} completedCount={0} />
  }
/>
```

The list panel header:
- Title "Torrents" (14px, 600 weight)
- Right side: "+ Add" button (emerald), Refresh button (ghost)

List items (44px height):
- 6px status dot (colored per status, no animation — just solid colors)
- Filename (13px, 500 weight, `text-[#f1f5f9]`, truncated)
- Right-aligned: size in `text-[#475569]`, status badge pill
- Selected: `border-l-2 border-[#10b981] bg-[rgba(16,185,129,0.04)]`
- Hover: `bg-[rgba(255,255,255,0.03)]`
- Active downloads: 2px `bg-[#3b82f6]` progress bar below filename
- `onClick` sets `selectedId`

Context menu: use `onContextMenu` handler. Implement as a simple custom context menu div (absolute positioned at mouse coords) with three actions:
- **Download**: check `settings.download_folder` first — if set, use it directly; if null, call `open({ directory: true })` to prompt. Then proceed with `unrestrictTorrentLinks` + `startDownloads` flow
- **Delete**: `window.confirm("Delete this torrent?")` then `deleteTorrent(id)`
- **Copy Magnet**: `navigator.clipboard.writeText("magnet:?xt=urn:btih:" + torrent.hash)`
Close on click outside or Esc.

For the StatsDashboard in the detail panel, the component needs download tasks and settings. Fetch settings via `getSettings()` on mount. For download tasks, poll `getDownloadTasks()` every 3 seconds (same pattern as DownloadsPage). The `completedCount` is tracked with a `useRef<number>` + `useRef<Set<string>>` (seen completed IDs). On each poll, check if any task has status "Completed" and its ID is not in the seen set — if so, increment the counter and add the ID. This tracks completions for the lifetime of the page component, which resets on navigation (acceptable — spec says "resets on app restart" and navigation reset is fine too).

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/pages/TorrentsPage.tsx src/components/TorrentDetail.tsx
git commit -m "feat: rewrite TorrentsPage and TorrentDetail with master-detail layout"
```

---

### Task 9: Rewrite DownloadsPage with Master-Detail

**Files:**
- Rewrite: `src/pages/DownloadsPage.tsx`

- [ ] **Step 1: Rewrite DownloadsPage with list panel + detail panel**

Use MasterDetail component. Same pattern as TorrentsPage.

List panel header:
- Title "Downloads" (14px, 600 weight)
- Right side: "Clear Completed" button (ghost, only visible when completed tasks exist)

List items (44px height each):
- 6px status dot (blue for downloading/pending, emerald for completed, red for failed/cancelled)
- Filename (13px, 500 weight, truncated)
- Right-aligned: size + status text or percentage
- Active downloads: 2px `bg-[#3b82f6]` progress bar below filename
- Selected: same emerald left border treatment

Detail panel when download selected:
- Filename header (14px, 600 weight)
- Progress: large percentage display, 3px progress bar (`bg-[#3b82f6]` fill on `bg-[rgba(59,130,246,0.08)]` track)
- Stats grid: Speed (formatted), ETA, Downloaded/Total bytes, Destination path (`task.destination`)
- Cancel button (for active downloads)
- For completed: show checkmark + "Download complete" + destination path
- For failed: show error message from `task.status.Failed`

When nothing selected: show StatsDashboard (same as TorrentsPage).

Listen for `refresh-list` event same as TorrentsPage.

Polling: keep the existing 3-second polling interval for `getDownloadTasks()`, plus merge with `useDownloadProgress()` hook data (same pattern as current DownloadsPage).

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/pages/DownloadsPage.tsx
git commit -m "feat: rewrite DownloadsPage with master-detail layout"
```

---

### Task 10: Restyle AddTorrentModal

**Files:**
- Rewrite: `src/components/AddTorrentModal.tsx`

- [ ] **Step 1: Restyle with noir+emerald**

Keep all existing logic. Only change styling:

- Backdrop: `bg-black/60 backdrop-blur-sm`, fade-in animation
- Card: `bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-xl`, slide-up animation, max-w-lg
- Title: 14px, 600 weight, `text-[#f1f5f9]`
- Textarea: `bg-[#08080f] border border-[rgba(255,255,255,0.06)] rounded-md text-[13px] text-[#f1f5f9] focus:border-[rgba(16,185,129,0.3)]`
- "Add Magnet" button: `bg-[#10b981] hover:bg-[#34d399] text-white rounded-md`
- "Upload .torrent" button: `bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-md text-[#94a3b8] hover:text-[#f1f5f9] hover:border-[rgba(255,255,255,0.1)]`
- Divider: `border-[rgba(255,255,255,0.04)]`
- Error: `text-[#ef4444] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.1)] rounded-md`

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/AddTorrentModal.tsx
git commit -m "feat: restyle AddTorrentModal with noir+emerald"
```

---

## Chunk 4: Command Palette + Settings Modal

### Task 11: Build CommandPalette

**Files:**
- Rewrite: `src/components/CommandPalette.tsx` (replace stub)

- [ ] **Step 1: Implement the full command palette**

Props: `{ onClose: () => void; torrents: Torrent[]; onSelectTorrent: (id: string) => void }`

The `torrents` prop is passed from Layout (which gets it from... we need to think about this). Actually, Layout doesn't have access to torrents. Let's simplify: CommandPalette fetches its own torrent list via `listTorrents()` when in "My Torrents" mode.

State:
- `query: string`
- `mode: "search" | "local"` (default "search")
- `results: SearchResult[]` (from tracker search)
- `localResults: Torrent[]` (filtered torrents)
- `loading: boolean`
- `selectedIndex: number` (for keyboard navigation)
- `addingHash: string | null`
- `addedHashes: Set<string>`
- `trackerStatus: TrackerStatus[]`
- `error: string`

Behavior:
- On mount: fetch local torrents via `listTorrents(1, 500)` for the "My Torrents" mode
- `Tab` key toggles between modes
- In "search" mode: debounce query at 300ms, call `searchTorrents(query, undefined, "seeders", 1)` from `src/api/search.ts`
- In "local" mode: filter `localTorrents` by filename match (case insensitive, instant)
- `↑↓` arrow keys: update `selectedIndex`, `preventDefault()` to avoid scrolling
- `Enter`: in search mode, add the selected result (`addMagnet` + `selectTorrentFiles`). In local mode, call `onSelectTorrent(torrent.id)` and close
- `Esc`: call `onClose()`
- Paste detection: if `query` starts with `magnet:?`, immediately call `const result = await addMagnet(query); await selectTorrentFiles(result.id, "all")`, show "Added!" feedback, clear input
- Click outside the palette card: `onClose()`

Visual:
- Backdrop: `fixed inset-0 bg-black/60 backdrop-blur-sm z-50`, fade-in animation
- Card: `w-[560px] max-h-[420px] bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]`, centered, scale+fade entry animation
- Input: `text-[15px] text-[#f1f5f9] bg-transparent w-full p-4 border-b border-[rgba(255,255,255,0.04)] outline-none placeholder:text-[#374151]`
- Mode tabs: two pills below input, `text-[11px]`. Active: `bg-[rgba(16,185,129,0.08)] text-[#10b981]`. Inactive: `text-[#475569]`
- Results: scrollable list, each item 40px. Title (13px, `text-[#f1f5f9]`), size + seeders right-aligned. Hovered/selected: `bg-[rgba(255,255,255,0.03)]`
- Source badge: `text-[10px] bg-[rgba(16,185,129,0.08)] text-[#10b981] rounded px-1.5 py-0.5`
- "Added" confirmation: emerald checkmark replaces the row briefly
- Tracker warnings: subtle text below results `text-[11px] text-[#eab308]`
- Loading: 3 skeleton lines (shimmer animation)
- Empty state: "No results" centered text

- [ ] **Step 2: Update Layout.tsx to pass needed props to CommandPalette**

CommandPalette doesn't need torrents from Layout — it fetches its own. But it does need `onSelectTorrent` to navigate to a torrent in the main list. Pass a callback that navigates to `/torrents` and dispatches a custom event `torrent-select` with the torrent ID:

```tsx
const handleSelectTorrent = (id: string) => {
  navigate("/torrents");
  window.dispatchEvent(new CustomEvent("torrent-select", { detail: id }));
  setShowSearch(false);
};

{showSearch && <CommandPalette onClose={() => setShowSearch(false)} onSelectTorrent={handleSelectTorrent} />}
```

TorrentsPage listens for this event and sets `selectedId`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/CommandPalette.tsx src/components/Layout.tsx
git commit -m "feat: implement CommandPalette with tracker search and local filter"
```

---

### Task 12: Build SettingsModal

**Files:**
- Rewrite: `src/components/SettingsModal.tsx` (replace stub)

- [ ] **Step 1: Implement the settings modal**

Props: `{ onClose: () => void }`

On mount: fetch settings via `getSettings()` from `src/api/settings.ts`.

State:
- `settings: AppSettings | null`
- `loading: boolean`
- `savedField: string | null` (which field just saved — for checkmark animation)

Auto-save: every time a setting changes, call `updateSettings(newSettings)`. Set `savedField` to the field name, clear it after 1.5 seconds. Show a brief emerald checkmark next to the changed field.

Visual:
- Backdrop: same as CommandPalette (`fixed inset-0 bg-black/60 backdrop-blur-sm z-50`)
- Card: `w-[440px] bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-xl p-6`, slide-up animation
- Title: "Settings" in 14px, 600 weight, `text-[#f1f5f9]`, with X close button (`text-[#475569] hover:text-[#f1f5f9]`)
- Three sections, each with `mb-6`:
  1. **Download Folder:** Label 11px `text-[#475569]` uppercase. Path display in `bg-[#08080f] rounded-md p-2.5 text-[13px] text-[#94a3b8] truncate`. "Browse" button (`bg-[rgba(255,255,255,0.04)] text-[#94a3b8] hover:text-[#f1f5f9] rounded-md px-3 py-2 text-[12px]`) calls `open({ directory: true })` from `@tauri-apps/plugin-dialog`
  2. **Concurrent Downloads:** Same label. `<select>` with noir styling, options: `[1, 2, 3, 4, 5, 8, 10]` (specific values per spec, NOT a 1-10 range)
  3. **Subfolders:** Toggle switch (custom styled checkbox or a simple toggle component). Label and description text
- `Esc` closes modal (handled in Layout, not here)

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: implement SettingsModal with auto-save"
```

---

## Chunk 5: Final Integration

### Task 13: Wire Everything Together + Final Cleanup

**Files:**
- Modify: `src/pages/TorrentsPage.tsx` (add torrent-select event listener)
- Modify: `src/components/Layout.tsx` (finalize CommandPalette props)

- [ ] **Step 1: Add torrent-select event listener to TorrentsPage**

In TorrentsPage, add a `useEffect` that listens for the `torrent-select` custom event dispatched by CommandPalette via Layout:

```tsx
useEffect(() => {
  const handler = (e: Event) => {
    const id = (e as CustomEvent).detail;
    setSelectedId(id);
  };
  window.addEventListener("torrent-select", handler);
  return () => window.removeEventListener("torrent-select", handler);
}, []);
```

- [ ] **Step 2: Verify full frontend build**

Run: `npm run build`
Expected: Clean build, no TypeScript errors.

- [ ] **Step 3: Verify Rust backend still compiles**

Run: `export PATH="$HOME/.cargo/bin:$PATH" && cd /Volumes/DATA/VibeCoding/DebridDownloader/src-tauri && cargo check`
Expected: Compiles (backend is unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/pages/TorrentsPage.tsx src/components/Layout.tsx
git commit -m "feat: wire CommandPalette torrent selection to TorrentsPage"
```

---

### Task 14: Final Integration Build

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run full Vite build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Verify no dead imports or references**

Check that no file imports from deleted pages (`SearchPage`, `HistoryPage`, `SettingsPage`).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete UI redesign v2 — noir+emerald, icon rail, command palette"
```
