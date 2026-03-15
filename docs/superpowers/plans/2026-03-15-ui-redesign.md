# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the icon-rail + master-detail layout with a labeled sidebar + full-width sortable table + slide-over detail panel.

**Architecture:** New layout: 200px labeled sidebar (Sidebar.tsx) + full-width content. Tables use a reusable DataTable component with sortable columns. Detail views use a SlideOverPanel that slides in from the right over a dimmed scrim. Download task polling is lifted from individual pages into Layout via React context.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, React Router v7, Tauri v2

**Spec:** `docs/superpowers/specs/2026-03-15-ui-redesign-design.md`

**No test framework is configured.** Verification is done via `npx tsc --noEmit` and visual inspection with `npm run tauri dev`.

---

## File Structure

### New files
| File | Purpose |
|------|---------|
| `src/components/Sidebar.tsx` | Labeled nav sidebar replacing IconRail |
| `src/components/DataTable.tsx` | Reusable sortable table with column config |
| `src/components/SlideOverPanel.tsx` | Animated right-side overlay panel |
| `src/components/TableToolbar.tsx` | Page title + filter input + action buttons |
| `src/hooks/useDownloadTasks.tsx` | React context + polling for download tasks |
| `src/pages/CompletedPage.tsx` | Completed downloads filtered view |

### Modified files
| File | Changes |
|------|---------|
| `src/styles/index.css` | Add `--color-noir-sidebar` token |
| `src/utils.ts` | Add `formatRelativeTime()` helper |
| `src/components/Layout.tsx` | Replace IconRail with Sidebar, add download tasks context provider |
| `src/App.tsx` | Add `/completed` route, import CompletedPage |
| `src/pages/TorrentsPage.tsx` | Full rewrite: DataTable + SlideOverPanel |
| `src/pages/DownloadsPage.tsx` | Full rewrite: DataTable + SlideOverPanel, consume context |

### Deleted files (after all rewrites complete)
| File | Reason |
|------|--------|
| `src/components/IconRail.tsx` | Replaced by Sidebar |
| `src/components/MasterDetail.tsx` | No longer used |
| `src/components/StatsDashboard.tsx` | Info redistributed to sidebar + toolbars |
| `src/components/TorrentDetail.tsx` | Logic moved into TorrentsPage slide-over content |

---

## Chunk 1: Foundation Components

### Task 1: Add design token + utility function

**Files:**
- Modify: `src/styles/index.css`
- Modify: `src/utils.ts`

- [ ] **Step 1: Add sidebar color token to index.css**

In `src/styles/index.css`, add inside the `@theme` block:

```css
  --color-noir-sidebar: #07070d;
```

- [ ] **Step 2: Add formatRelativeTime to utils.ts**

Append to `src/utils.ts`:

```typescript
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffDays < 1) {
    if (diffHr >= 1) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
    if (diffMin >= 1) return `${diffMin} min ago`;
    return "just now";
  }
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 4: Commit**

```bash
git add src/styles/index.css src/utils.ts
git commit -m "feat: add sidebar token and formatRelativeTime utility"
```

---

### Task 2: Create DataTable component

**Files:**
- Create: `src/components/DataTable.tsx`

- [ ] **Step 1: Create DataTable.tsx**

```tsx
import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  width: string;
  sortable?: boolean;
  render: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  onRowContextMenu?: (item: T, e: React.MouseEvent) => void;
  selectedId?: string | null;
  sortKey?: string | null;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string, direction: "asc" | "desc") => void;
  emptyMessage?: string;
  emptySubtext?: string;
  loading?: boolean;
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  onRowContextMenu,
  selectedId,
  sortKey,
  sortDirection,
  onSort,
  emptyMessage = "No items",
  emptySubtext,
  loading,
}: DataTableProps<T>) {
  const gridTemplateColumns = columns.map((c) => c.width).join(" ");

  const handleHeaderClick = (col: Column<T>) => {
    if (!col.sortable || !onSort) return;
    if (sortKey === col.key) {
      onSort(col.key, sortDirection === "asc" ? "desc" : "asc");
    } else {
      onSort(col.key, "asc");
    }
  };

  const sortArrow = (col: Column<T>) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key) return <span style={{ color: "#374151" }}> ↕</span>;
    return <span style={{ color: "#10b981" }}> {sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-[rgba(16,185,129,0.3)] border-t-[#10b981] rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-[#475569] text-[15px]">{emptyMessage}</p>
        {emptySubtext && (
          <p className="text-[#374151] text-[14px] mt-1">{emptySubtext}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-7">
      {/* Header */}
      <div
        className="sticky top-0 z-10"
        style={{
          display: "grid",
          gridTemplateColumns,
          gap: "16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "#0a0a12",
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            onClick={() => handleHeaderClick(col)}
            className="text-[12px] text-[#475569] uppercase tracking-[0.5px] py-3 select-none"
            style={{ cursor: col.sortable ? "pointer" : "default" }}
          >
            {col.header}
            {sortArrow(col)}
          </div>
        ))}
      </div>

      {/* Rows */}
      {data.map((item) => {
        const id = rowKey(item);
        return (
          <div
            key={id}
            onClick={() => onRowClick?.(item)}
            onContextMenu={(e) => {
              e.preventDefault();
              onRowContextMenu?.(item, e);
            }}
            className="transition-colors duration-150 cursor-pointer"
            style={{
              display: "grid",
              gridTemplateColumns,
              gap: "16px",
              alignItems: "center",
              padding: "14px 0",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              background:
                selectedId === id
                  ? "rgba(16,185,129,0.04)"
                  : undefined,
            }}
            onMouseEnter={(e) => {
              if (selectedId !== id) {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.02)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                selectedId === id
                  ? "rgba(16,185,129,0.04)"
                  : "transparent";
            }}
          >
            {columns.map((col) => (
              <div key={col.key} className="min-w-0">
                {col.render(item)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/components/DataTable.tsx
git commit -m "feat: add reusable DataTable component with sorting"
```

---

### Task 3: Create SlideOverPanel component

**Files:**
- Create: `src/components/SlideOverPanel.tsx`

- [ ] **Step 1: Create SlideOverPanel.tsx**

```tsx
import { useEffect, type ReactNode } from "react";

interface SlideOverPanelProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function SlideOverPanel({
  open,
  onClose,
  children,
}: SlideOverPanelProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: "420px",
          backgroundColor: "#0e0e18",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.5)",
          animation: "slide-in-right 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add slide-in-right keyframe to index.css**

Append to `src/styles/index.css` (after the existing `@keyframes` block):

```css
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 4: Commit**

```bash
git add src/components/SlideOverPanel.tsx src/styles/index.css
git commit -m "feat: add SlideOverPanel component with scrim and animation"
```

---

### Task 4: Create TableToolbar component

**Files:**
- Create: `src/components/TableToolbar.tsx`

- [ ] **Step 1: Create TableToolbar.tsx**

```tsx
interface TableToolbarProps {
  title: string;
  subtitle?: string;
  filterPlaceholder?: string;
  filterValue: string;
  onFilterChange: (value: string) => void;
  actions?: React.ReactNode;
}

export default function TableToolbar({
  title,
  subtitle,
  filterPlaceholder = "Filter...",
  filterValue,
  onFilterChange,
  actions,
}: TableToolbarProps) {
  return (
    <div className="flex justify-between items-center px-7 py-5">
      <div>
        <h2 className="text-[22px] font-bold text-[#f1f5f9] tracking-[-0.3px] m-0">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[13px] text-[#475569] mt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="text"
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder={filterPlaceholder}
            className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] rounded-lg py-2.5 pl-10 pr-4 text-[14px] text-[#f1f5f9] w-[240px] outline-none placeholder:text-[#374151] focus:border-[rgba(16,185,129,0.3)] transition-colors"
          />
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#475569"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        {actions}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/components/TableToolbar.tsx
git commit -m "feat: add TableToolbar component with filter input"
```

---

### Task 5: Create Sidebar component

**Files:**
- Create: `src/components/Sidebar.tsx`

- [ ] **Step 1: Create Sidebar.tsx**

```tsx
import { useRef, useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
}

export default function Sidebar({
  activeView,
  onNavigate,
  onSearchOpen,
  onSettingsOpen,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [popoverOpen]);

  const premiumDays = user
    ? Math.ceil(
        (new Date(user.expiration).getTime() - Date.now()) / 86400000
      )
    : 0;

  const navItems = [
    {
      section: "Library",
      items: [
        {
          id: "torrents",
          label: "Torrents",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          ),
          onClick: () => onNavigate("torrents"),
        },
        {
          id: "downloads",
          label: "Downloads",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
          ),
          onClick: () => onNavigate("downloads"),
        },
        {
          id: "completed",
          label: "Completed",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ),
          onClick: () => onNavigate("completed"),
        },
      ],
    },
    {
      section: "System",
      items: [
        {
          id: "search",
          label: "Search",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          ),
          onClick: onSearchOpen,
        },
        {
          id: "settings",
          label: "Settings",
          icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ),
          onClick: onSettingsOpen,
        },
      ],
    },
  ];

  return (
    <aside
      className="w-[200px] h-full flex flex-col shrink-0"
      style={{
        backgroundColor: "#07070d",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div
          className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
        >
          <span className="text-white font-bold text-[15px] leading-none">D</span>
        </div>
        <span className="text-[#f1f5f9] text-[15px] font-semibold">Debrid</span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 overflow-y-auto">
        {navItems.map((section) => (
          <div key={section.section} className="mb-6">
            <div className="text-[11px] text-[#475569] uppercase tracking-[1px] px-2 mb-2">
              {section.section}
            </div>
            {section.items.map((item) => {
              const isActive =
                item.id === activeView &&
                item.id !== "search" &&
                item.id !== "settings";
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-2.5 rounded-lg text-left transition-colors duration-150 mb-0.5"
                  style={{
                    padding: "10px 12px",
                    fontSize: "14px",
                    fontWeight: isActive ? 500 : 400,
                    backgroundColor: isActive
                      ? "rgba(16,185,129,0.08)"
                      : "transparent",
                    color: isActive ? "#10b981" : "#64748b",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "rgba(255,255,255,0.03)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "transparent";
                    }
                  }}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="relative px-5 py-3.5 border-t border-[rgba(255,255,255,0.04)]">
        <button
          ref={avatarRef}
          onClick={() => setPopoverOpen((prev) => !prev)}
          className="flex items-center gap-2.5 w-full text-left"
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-semibold"
              style={{
                backgroundColor: "rgba(16,185,129,0.15)",
                color: "#10b981",
                fontSize: "13px",
              }}
            >
              {user?.username?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[14px] text-[#e2e8f0] font-medium truncate">
              {user?.username}
            </div>
            <div className="text-[12px] text-[#475569]">
              {premiumDays} days left
            </div>
          </div>
        </button>

        {popoverOpen && (
          <div
            ref={popoverRef}
            className="absolute rounded-lg p-4 w-48"
            style={{
              bottom: "100%",
              left: "12px",
              marginBottom: "8px",
              backgroundColor: "#0f0f18",
              border: "1px solid rgba(255,255,255,0.06)",
              zIndex: 50,
            }}
          >
            <p className="text-[15px] text-[#f1f5f9] font-medium truncate">
              {user?.username}
            </p>
            {user?.expiration && (
              <p className="text-[13px] text-[#475569]">
                Premium until{" "}
                {new Date(user.expiration).toLocaleDateString()}
              </p>
            )}
            <button
              onClick={async () => {
                setPopoverOpen(false);
                await logout();
              }}
              className="w-full text-left rounded-md px-2 py-2 mt-2 transition-colors duration-150 text-[14px] text-[#ef4444]"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "rgba(239,68,68,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add labeled Sidebar component"
```

---

### Task 6: Create useDownloadTasks context hook

**Files:**
- Create: `src/hooks/useDownloadTasks.tsx`

- [ ] **Step 1: Create useDownloadTasks.tsx**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import * as downloadsApi from "../api/downloads";
import type { DownloadTask, DownloadProgress } from "../types";

interface DownloadTasksContextValue {
  tasks: DownloadTask[];
  refreshTasks: () => Promise<void>;
}

const DownloadTasksContext = createContext<DownloadTasksContextValue>({
  tasks: [],
  refreshTasks: async () => {},
});

export function DownloadTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [progress, setProgress] = useState<Map<string, DownloadProgress>>(new Map());

  // Listen for real-time progress events
  useEffect(() => {
    const unlisten = listen<DownloadProgress>("download-progress", (event) => {
      setProgress((prev) => {
        const next = new Map(prev);
        next.set(event.payload.id, event.payload);
        return next;
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Poll for task list every 3 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await downloadsApi.getDownloadTasks();
        setTasks(data);
      } catch {
        // ignore
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen for refresh-list events
  useEffect(() => {
    const handler = async () => {
      try {
        const data = await downloadsApi.getDownloadTasks();
        setTasks(data);
      } catch {
        // ignore
      }
    };
    window.addEventListener("refresh-list", handler);
    return () => window.removeEventListener("refresh-list", handler);
  }, []);

  const refreshTasks = async () => {
    try {
      const data = await downloadsApi.getDownloadTasks();
      setTasks(data);
    } catch {
      // ignore
    }
  };

  // Merge real-time progress into tasks
  const mergedTasks = tasks.map((task) => {
    const p = progress.get(task.id);
    if (p) {
      return {
        ...task,
        downloaded_bytes: p.downloaded_bytes,
        total_bytes: p.total_bytes,
        speed: p.speed,
        status: p.status,
      };
    }
    return task;
  });

  return (
    <DownloadTasksContext.Provider value={{ tasks: mergedTasks, refreshTasks }}>
      {children}
    </DownloadTasksContext.Provider>
  );
}

export function useDownloadTasks() {
  return useContext(DownloadTasksContext);
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDownloadTasks.tsx
git commit -m "feat: add useDownloadTasks context with centralized polling"
```

---

## Chunk 2: Layout + Routing Rewire

### Task 7: Rewrite Layout.tsx to use Sidebar + context provider

**Files:**
- Modify: `src/components/Layout.tsx`

- [ ] **Step 1: Rewrite Layout.tsx**

Replace the entire contents of `src/components/Layout.tsx` with:

```tsx
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import SettingsModal from "./SettingsModal";
import { DownloadTasksProvider } from "../hooks/useDownloadTasks";

export default function Layout() {
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const activeView = location.pathname.startsWith("/downloads")
    ? "downloads"
    : location.pathname.startsWith("/completed")
    ? "completed"
    : "torrents";

  const handleNavigate = (view: string) => {
    navigate("/" + view);
  };

  const handleSelectTorrent = (id: string) => {
    navigate("/torrents");
    window.dispatchEvent(new CustomEvent("torrent-select", { detail: id }));
    setShowSearch(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "k") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
        return;
      }

      if (e.metaKey && e.key === "r") {
        e.preventDefault();
        window.dispatchEvent(new Event("refresh-list"));
        return;
      }

      if (e.key === "Escape") {
        if (showSearch) {
          setShowSearch(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else {
          window.dispatchEvent(new Event("deselect-item"));
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          window.dispatchEvent(new Event("delete-selected"));
        }
        return;
      }

      if (e.key === "Enter") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") {
          window.dispatchEvent(new Event("action-selected"));
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, showSettings]);

  return (
    <DownloadTasksProvider>
      <div className="flex h-screen overflow-hidden bg-[#08080f]">
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          onSearchOpen={() => setShowSearch(true)}
          onSettingsOpen={() => setShowSettings(true)}
        />
        <main className="flex-1 overflow-hidden flex flex-col" style={{ background: "#0a0a12" }}>
          <Outlet />
        </main>
        {showSearch && (
          <CommandPalette
            onClose={() => setShowSearch(false)}
            onSelectTorrent={handleSelectTorrent}
          />
        )}
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
        )}
      </div>
    </DownloadTasksProvider>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: rewrite Layout with Sidebar and DownloadTasksProvider"
```

---

### Task 8: Add /completed route to App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add CompletedPage import and route**

In `src/App.tsx`, add the import at the top alongside existing page imports:

```typescript
import CompletedPage from "./pages/CompletedPage";
```

Add the route inside the authenticated `<Route element={<Layout />}>` block, after the downloads route:

```tsx
<Route path="/completed" element={<CompletedPage />} />
```

- [ ] **Step 2: Create a placeholder CompletedPage**

Create `src/pages/CompletedPage.tsx` with a placeholder so types pass:

```tsx
export default function CompletedPage() {
  return <div className="p-8 text-[#475569]">Completed page placeholder</div>;
}
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/CompletedPage.tsx
git commit -m "feat: add /completed route with placeholder page"
```

---

## Chunk 3: Page Rewrites

### Task 9: Rewrite TorrentsPage

**Files:**
- Modify: `src/pages/TorrentsPage.tsx`

- [ ] **Step 1: Rewrite TorrentsPage.tsx**

Replace the entire contents of `src/pages/TorrentsPage.tsx`. This is the largest single file change. The new version uses DataTable, TableToolbar, SlideOverPanel, and inline torrent detail content (moved from TorrentDetail.tsx).

Key behaviors to preserve:
- Fetch torrents via `torrentsApi.listTorrents(1, 500)` on mount
- Listen for `refresh-list`, `torrent-select`, `deselect-item`, `delete-selected`, `action-selected` window events
- Context menu on right-click with Download, Delete, Copy Magnet
- Download flow: get settings → pick folder if not set → unrestrict links → start downloads
- Add torrent modal triggered from toolbar button

The new version adds:
- Sortable columns (name, size, added)
- Inline filter by filename
- Slide-over panel for torrent detail (replaces master-detail right panel)
- Quick download button per row (for status "downloaded")

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import DataTable, { type Column } from "../components/DataTable";
import TableToolbar from "../components/TableToolbar";
import SlideOverPanel from "../components/SlideOverPanel";
import AddTorrentModal from "../components/AddTorrentModal";
import * as torrentsApi from "../api/torrents";
import * as downloadsApi from "../api/downloads";
import { getSettings } from "../api/settings";
import type { Torrent, TorrentInfo, AppSettings } from "../types";
import {
  formatBytes,
  formatRelativeTime,
  torrentStatusLabel,
} from "../utils";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "downloaded":
      return "bg-[rgba(16,185,129,0.12)] text-[#10b981]";
    case "downloading":
      return "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]";
    case "waiting_files_selection":
    case "queued":
    case "magnet_conversion":
      return "bg-[rgba(234,179,8,0.12)] text-[#eab308]";
    case "error":
    case "dead":
    case "magnet_error":
      return "bg-[rgba(239,68,68,0.12)] text-[#ef4444]";
    default:
      return "bg-[rgba(148,163,184,0.12)] text-[#94a3b8]";
  }
}

export default function TorrentsPage() {
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("added");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; torrentId: string } | null>(null);

  // Slide-over detail state
  const [detailInfo, setDetailInfo] = useState<TorrentInfo | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchTorrents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await torrentsApi.listTorrents(1, 500);
      setTorrents(data);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTorrents(); }, [fetchTorrents]);
  useEffect(() => { getSettings().then(setSettings).catch(() => {}); }, []);

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) { setDetailInfo(null); return; }
    const fetchInfo = async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const data = await torrentsApi.getTorrentInfo(selectedId);
        setDetailInfo(data);
        setSelectedFiles(new Set(data.files.filter((f) => f.selected === 1).map((f) => f.id)));
      } catch (e) {
        setDetailError(String(e));
      } finally {
        setDetailLoading(false);
      }
    };
    fetchInfo();
  }, [selectedId]);

  // Window event listeners
  useEffect(() => {
    const handler = () => fetchTorrents();
    window.addEventListener("refresh-list", handler);
    return () => window.removeEventListener("refresh-list", handler);
  }, [fetchTorrents]);

  useEffect(() => {
    const handler = (e: Event) => setSelectedId((e as CustomEvent).detail);
    window.addEventListener("torrent-select", handler);
    return () => window.removeEventListener("torrent-select", handler);
  }, []);

  useEffect(() => {
    const handler = () => setSelectedId(null);
    window.addEventListener("deselect-item", handler);
    return () => window.removeEventListener("deselect-item", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (selectedId && window.confirm("Delete this torrent?")) handleDelete(selectedId);
    };
    window.addEventListener("delete-selected", handler);
    return () => window.removeEventListener("delete-selected", handler);
  }, [selectedId]);

  useEffect(() => {
    const handler = () => { if (selectedId) handleDownloadTorrent(selectedId); };
    window.addEventListener("action-selected", handler);
    return () => window.removeEventListener("action-selected", handler);
  }, [selectedId, settings]);

  // Close context menu
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const handleDelete = async (id: string) => {
    try {
      await torrentsApi.deleteTorrent(id);
      setTorrents((prev) => prev.filter((t) => t.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) { setError(String(e)); }
  };

  const handleDownloadTorrent = async (id: string) => {
    const torrent = torrents.find((t) => t.id === id);
    if (!torrent) return;
    try {
      let folder = settings?.download_folder ?? null;
      if (!folder) {
        const picked = await open({ directory: true, title: "Select download folder" });
        if (!picked) return;
        folder = picked as string;
      }
      const links = await downloadsApi.unrestrictTorrentLinks(id);
      if (links.length > 0) await downloadsApi.startDownloads(links, folder, torrent.filename);
    } catch (e) { setError(String(e)); }
  };

  const handleSelectFiles = async () => {
    if (!detailInfo) return;
    setSaving(true);
    try {
      const ids = Array.from(selectedFiles).join(",");
      await torrentsApi.selectTorrentFiles(detailInfo.id, ids || "all");
      fetchTorrents();
    } catch (e) { setDetailError(String(e)); }
    finally { setSaving(false); }
  };

  const handleDetailDownload = async () => {
    if (!detailInfo) return;
    setDownloading(true);
    try {
      const s = await getSettings();
      let folder = s.download_folder;
      if (!folder) {
        const picked = await open({ directory: true, title: "Select download folder" });
        if (!picked) { setDownloading(false); return; }
        folder = picked as string;
      }
      const links = await downloadsApi.unrestrictTorrentLinks(detailInfo.id);
      if (links.length > 0) await downloadsApi.startDownloads(links, folder, detailInfo.filename);
      fetchTorrents();
    } catch (e) { setDetailError(String(e)); }
    finally { setDownloading(false); }
  };

  const handleDetailDelete = async () => {
    if (!detailInfo || !window.confirm("Delete this torrent?")) return;
    try {
      await torrentsApi.deleteTorrent(detailInfo.id);
      setSelectedId(null);
      fetchTorrents();
    } catch (e) { setDetailError(String(e)); }
  };

  // Sort + filter
  const filtered = useMemo(() => {
    let result = torrents;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((t) => t.filename.toLowerCase().includes(q));
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "filename") cmp = a.filename.localeCompare(b.filename);
        else if (sortKey === "bytes") cmp = a.bytes - b.bytes;
        else if (sortKey === "added") cmp = new Date(a.added).getTime() - new Date(b.added).getTime();
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [torrents, filter, sortKey, sortDirection]);

  const totalBytes = torrents.reduce((s, t) => s + t.bytes, 0);

  const columns: Column<Torrent>[] = [
    {
      key: "filename",
      header: "Name",
      width: "1fr",
      sortable: true,
      render: (t) => (
        <div className="text-[15px] font-medium text-[#f1f5f9] truncate">{t.filename}</div>
      ),
    },
    {
      key: "bytes",
      header: "Size",
      width: "100px",
      sortable: true,
      render: (t) => <span className="text-[14px] text-[#94a3b8]">{formatBytes(t.bytes)}</span>,
    },
    {
      key: "added",
      header: "Added",
      width: "110px",
      sortable: true,
      render: (t) => <span className="text-[13px] text-[#64748b]">{formatRelativeTime(t.added)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (t) => (
        <span className={`text-[12px] px-2.5 py-1 rounded-md font-medium ${statusBadgeClass(t.status)}`}>
          {torrentStatusLabel(t.status)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "70px",
      render: (t) => (
        <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {t.status === "downloaded" && (
            <button
              onClick={() => handleDownloadTorrent(t.id)}
              className="w-[30px] h-[30px] rounded-md flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}
              title="Download"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, torrentId: t.id });
            }}
            className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[#64748b]"
            style={{ background: "rgba(255,255,255,0.04)" }}
            title="More"
          >
            ···
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <TableToolbar
        title="Torrents"
        subtitle={`${torrents.length} items · ${formatBytes(totalBytes)}`}
        filterPlaceholder="Filter torrents..."
        filterValue={filter}
        onFilterChange={setFilter}
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="text-white rounded-lg px-5 py-2.5 text-[14px] font-medium transition-colors"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            + Add
          </button>
        }
      />

      {error && (
        <div className="px-7 py-3 text-[14px] text-[#ef4444] bg-[rgba(239,68,68,0.06)]">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(t) => t.id}
        onRowClick={(t) => setSelectedId(t.id)}
        onRowContextMenu={(t, e) =>
          setContextMenu({ x: e.clientX, y: e.clientY, torrentId: t.id })
        }
        selectedId={selectedId}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
        emptyMessage="No torrents yet"
        emptySubtext="Add a magnet link or torrent file to get started"
        loading={loading}
      />

      {/* Slide-over detail */}
      <SlideOverPanel open={!!selectedId} onClose={() => setSelectedId(null)}>
        {detailLoading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-6 h-6 border-2 border-[rgba(16,185,129,0.3)] border-t-[#10b981] rounded-full animate-spin" />
          </div>
        ) : detailInfo ? (
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b border-[rgba(255,255,255,0.06)] flex justify-between items-start gap-3">
              <div className="min-w-0">
                <span className={`text-[12px] px-2.5 py-1 rounded-full font-medium inline-block mb-2 ${statusBadgeClass(detailInfo.status)}`}>
                  {torrentStatusLabel(detailInfo.status)}
                </span>
                <h3 className="text-[18px] font-bold text-[#f1f5f9] leading-snug break-words">
                  {detailInfo.filename}
                </h3>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748b] hover:text-[#f1f5f9] shrink-0"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {detailError && <p className="text-[#ef4444] text-[14px] mb-4">{detailError}</p>}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                  <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Size</div>
                  <div className="text-[17px] text-[#f1f5f9] font-semibold">{formatBytes(detailInfo.bytes)}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                  <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Added</div>
                  <div className="text-[15px] text-[#f1f5f9] font-medium">{new Date(detailInfo.added).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                  <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Links</div>
                  <div className="text-[17px] text-[#f1f5f9] font-semibold">{detailInfo.links.length}</div>
                </div>
                <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                  <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Hash</div>
                  <div className="text-[12px] text-[#94a3b8] font-mono truncate">{detailInfo.hash}</div>
                </div>
              </div>

              {/* Files */}
              {detailInfo.files.length > 0 && (
                <div>
                  <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-2.5">
                    Files ({detailInfo.files.length})
                  </div>
                  <div className="rounded-[10px] border border-[rgba(255,255,255,0.04)] overflow-hidden max-h-64 overflow-y-auto">
                    {detailInfo.files.map((file) => (
                      <label
                        key={file.id}
                        className="flex items-center gap-2.5 px-3.5 py-3 cursor-pointer border-b border-[rgba(255,255,255,0.04)] last:border-b-0 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => {
                            setSelectedFiles((prev) => {
                              const next = new Set(prev);
                              if (next.has(file.id)) next.delete(file.id);
                              else next.add(file.id);
                              return next;
                            });
                          }}
                          className="accent-[#10b981]"
                        />
                        <span className="flex-1 text-[14px] text-[#f1f5f9] truncate min-w-0">
                          {file.path.startsWith("/") ? file.path.slice(1) : file.path}
                        </span>
                        <span className="text-[12px] text-[#475569] shrink-0">
                          {formatBytes(file.bytes)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.06)] flex gap-2.5">
              {detailInfo.status === "waiting_files_selection" && (
                <button
                  onClick={handleSelectFiles}
                  disabled={saving || selectedFiles.size === 0}
                  className="flex-1 py-3 rounded-[10px] text-white text-[15px] font-semibold disabled:opacity-40 transition-colors"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
                >
                  {saving ? "Saving..." : "Select Files & Start"}
                </button>
              )}
              {detailInfo.status === "downloaded" && (
                <button
                  onClick={handleDetailDownload}
                  disabled={downloading}
                  className="flex-1 py-3 rounded-[10px] text-white text-[15px] font-semibold disabled:opacity-40 transition-colors"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                >
                  {downloading ? "Starting..." : "Download"}
                </button>
              )}
              <button
                onClick={handleDetailDelete}
                className="py-3 px-5 rounded-[10px] text-[#ef4444] text-[14px] transition-colors"
                style={{ background: "rgba(239,68,68,0.06)" }}
              >
                Delete
              </button>
            </div>
          </>
        ) : detailError ? (
          <div className="p-6">
            <p className="text-[#ef4444] text-[15px]">{detailError}</p>
          </div>
        ) : null}
      </SlideOverPanel>

      {/* Add torrent modal */}
      {showAdd && (
        <AddTorrentModal
          onClose={() => setShowAdd(false)}
          onAdded={fetchTorrents}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-lg py-1.5 w-52 z-[60] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2.5 text-[15px] text-[#f1f5f9] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            onClick={() => { const id = contextMenu.torrentId; setContextMenu(null); handleDownloadTorrent(id); }}
          >
            Download
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-[15px] text-[#ef4444] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            onClick={() => { const id = contextMenu.torrentId; setContextMenu(null); if (window.confirm("Delete this torrent?")) handleDelete(id); }}
          >
            Delete
          </button>
          <button
            className="w-full text-left px-4 py-2.5 text-[15px] text-[#f1f5f9] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            onClick={() => {
              const torrent = torrents.find((t) => t.id === contextMenu.torrentId);
              setContextMenu(null);
              if (torrent) navigator.clipboard.writeText("magnet:?xt=urn:btih:" + torrent.hash);
            }}
          >
            Copy Magnet
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/TorrentsPage.tsx
git commit -m "feat: rewrite TorrentsPage with DataTable + SlideOverPanel"
```

---

### Task 10: Rewrite DownloadsPage

**Files:**
- Modify: `src/pages/DownloadsPage.tsx`

- [ ] **Step 1: Rewrite DownloadsPage.tsx**

Replace the entire file. Uses DataTable, TableToolbar, SlideOverPanel, and the shared `useDownloadTasks` context.

```tsx
import { useEffect, useState, useMemo } from "react";
import DataTable, { type Column } from "../components/DataTable";
import TableToolbar from "../components/TableToolbar";
import SlideOverPanel from "../components/SlideOverPanel";
import { useDownloadTasks } from "../hooks/useDownloadTasks";
import * as downloadsApi from "../api/downloads";
import type { DownloadTask } from "../types";
import { formatBytes, formatSpeed, formatEta, getDownloadStatusText } from "../utils";

function isActive(status: DownloadTask["status"]): boolean {
  return status === "Downloading" || status === "Pending";
}

function statusBadgeClass(status: DownloadTask["status"]): string {
  if (status === "Downloading" || status === "Pending") return "bg-[rgba(59,130,246,0.12)] text-[#3b82f6]";
  if (status === "Cancelled") return "bg-[rgba(239,68,68,0.12)] text-[#ef4444]";
  if (typeof status === "object" && "Failed" in status) return "bg-[rgba(239,68,68,0.12)] text-[#ef4444]";
  return "bg-[rgba(148,163,184,0.12)] text-[#94a3b8]";
}

export default function DownloadsPage() {
  const { tasks } = useDownloadTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);

  // Only show non-completed tasks
  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== "Completed"), [tasks]);

  const filtered = useMemo(() => {
    let result = activeTasks;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((t) => t.filename.toLowerCase().includes(q));
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "filename") cmp = a.filename.localeCompare(b.filename);
        else if (sortKey === "total_bytes") cmp = a.total_bytes - b.total_bytes;
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [activeTasks, filter, sortKey, sortDirection]);

  const selectedTask = filtered.find((t) => t.id === selectedId) ?? null;

  // Window event listeners
  useEffect(() => {
    const handler = () => setSelectedId(null);
    window.addEventListener("deselect-item", handler);
    return () => window.removeEventListener("deselect-item", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (selectedId) downloadsApi.cancelDownload(selectedId).catch(() => {});
    };
    window.addEventListener("delete-selected", handler);
    return () => window.removeEventListener("delete-selected", handler);
  }, [selectedId]);

  // Close context menu
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const handleCancel = async (id: string) => {
    try { await downloadsApi.cancelDownload(id); } catch { /* ignore */ }
  };

  const columns: Column<DownloadTask>[] = [
    {
      key: "filename",
      header: "Name",
      width: "1fr",
      sortable: true,
      render: (t) => {
        const active = isActive(t.status);
        const pct = t.total_bytes > 0 ? (t.downloaded_bytes / t.total_bytes) * 100 : 0;
        return (
          <div>
            <div className="text-[15px] font-medium text-[#f1f5f9] truncate">{t.filename}</div>
            {active && pct > 0 && (
              <div className="mt-1.5 h-[3px] rounded-full bg-[rgba(59,130,246,0.08)]">
                <div className="h-full bg-[#3b82f6] rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "total_bytes",
      header: "Size",
      width: "100px",
      sortable: true,
      render: (t) => <span className="text-[14px] text-[#94a3b8]">{formatBytes(t.total_bytes)}</span>,
    },
    {
      key: "speed",
      header: "Speed",
      width: "100px",
      render: (t) => (
        <span className="text-[13px] text-[#64748b]">
          {isActive(t.status) && t.speed > 0 ? formatSpeed(t.speed) : "--"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (t) => {
        if (isActive(t.status) && t.total_bytes > 0) {
          const pct = ((t.downloaded_bytes / t.total_bytes) * 100).toFixed(1);
          return <span className="text-[13px] text-[#3b82f6] font-medium">{pct}%</span>;
        }
        return (
          <span className={`text-[12px] px-2.5 py-1 rounded-md font-medium ${statusBadgeClass(t.status)}`}>
            {getDownloadStatusText(t.status)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      width: "70px",
      render: (t) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {isActive(t.status) ? (
            <button
              onClick={() => handleCancel(t.id)}
              className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[#ef4444]"
              style={{ background: "rgba(239,68,68,0.08)" }}
              title="Cancel"
            >
              ×
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, taskId: t.id });
              }}
              className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[#64748b]"
              style={{ background: "rgba(255,255,255,0.04)" }}
            >
              ···
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <TableToolbar
        title="Downloads"
        subtitle={`${activeTasks.length} active`}
        filterPlaceholder="Filter downloads..."
        filterValue={filter}
        onFilterChange={setFilter}
      />

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(t) => t.id}
        onRowClick={(t) => setSelectedId(t.id)}
        onRowContextMenu={(t, e) => setContextMenu({ x: e.clientX, y: e.clientY, taskId: t.id })}
        selectedId={selectedId}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
        emptyMessage="No active downloads"
        emptySubtext="Download torrents from the Torrents page"
      />

      {/* Slide-over */}
      <SlideOverPanel open={!!selectedTask} onClose={() => setSelectedId(null)}>
        {selectedTask && (() => {
          const task = selectedTask;
          const active = isActive(task.status);
          const pct = task.total_bytes > 0 ? (task.downloaded_bytes / task.total_bytes) * 100 : 0;
          const isFailed = typeof task.status === "object" && "Failed" in task.status;
          const isCancelled = task.status === "Cancelled";

          return (
            <>
              {/* Header */}
              <div className="px-6 py-5 border-b border-[rgba(255,255,255,0.06)] flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h3 className="text-[18px] font-bold text-[#f1f5f9] leading-snug break-words">
                    {task.filename}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748b] hover:text-[#f1f5f9] shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {active && (
                  <>
                    <div className="text-[28px] font-semibold text-[#3b82f6] mb-3">
                      {pct.toFixed(1)}%
                    </div>
                    <div className="h-1 rounded-full bg-[rgba(59,130,246,0.08)] mb-5">
                      <div className="h-full rounded-full bg-[#3b82f6] transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                        <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Speed</div>
                        <div className="text-[15px] text-[#f1f5f9] font-medium">{task.speed > 0 ? formatSpeed(task.speed) : "--"}</div>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                        <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">ETA</div>
                        <div className="text-[15px] text-[#f1f5f9] font-medium">{formatEta(task.total_bytes, task.downloaded_bytes, task.speed)}</div>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                        <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Downloaded</div>
                        <div className="text-[15px] text-[#f1f5f9] font-medium">{formatBytes(task.downloaded_bytes)} <span className="text-[#475569]">of</span> {formatBytes(task.total_bytes)}</div>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                        <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Destination</div>
                        <div className="text-[14px] text-[#f1f5f9] font-medium truncate">{task.destination || "--"}</div>
                      </div>
                    </div>
                  </>
                )}

                {(isFailed || isCancelled) && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[#ef4444] text-[15px]">{getDownloadStatusText(task.status)}</p>
                    {task.destination && (
                      <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                        <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Destination</div>
                        <div className="text-[15px] text-[#f1f5f9] font-medium break-all">{task.destination}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.06)] flex gap-2.5">
                {active && (
                  <button
                    onClick={() => handleCancel(task.id)}
                    className="py-3 px-5 rounded-[10px] text-[#ef4444] text-[14px] transition-colors"
                    style={{ background: "rgba(239,68,68,0.06)" }}
                  >
                    Cancel Download
                  </button>
                )}
              </div>
            </>
          );
        })()}
      </SlideOverPanel>

      {/* Context menu */}
      {contextMenu && (() => {
        const menuTask = filtered.find((t) => t.id === contextMenu.taskId);
        const menuActive = menuTask ? isActive(menuTask.status) : false;
        return (
          <div
            className="fixed bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-lg py-1.5 w-52 z-[60] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {menuActive ? (
              <button
                className="w-full text-left px-4 py-2.5 text-[15px] text-[#ef4444] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                onClick={() => { setContextMenu(null); handleCancel(contextMenu.taskId); }}
              >
                Cancel
              </button>
            ) : (
              <button
                className="w-full text-left px-4 py-2.5 text-[15px] text-[#ef4444] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                onClick={() => { setContextMenu(null); /* hide from list client-side */ }}
              >
                Remove
              </button>
            )}
          </div>
        );
      })()}
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/DownloadsPage.tsx
git commit -m "feat: rewrite DownloadsPage with DataTable + SlideOverPanel"
```

---

### Task 11: Implement CompletedPage

**Files:**
- Modify: `src/pages/CompletedPage.tsx`

- [ ] **Step 1: Write CompletedPage.tsx**

Replace the placeholder with the full implementation:

```tsx
import { useEffect, useState, useMemo } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import DataTable, { type Column } from "../components/DataTable";
import TableToolbar from "../components/TableToolbar";
import SlideOverPanel from "../components/SlideOverPanel";
import { useDownloadTasks } from "../hooks/useDownloadTasks";
import * as downloadsApi from "../api/downloads";
import type { DownloadTask } from "../types";
import { formatBytes } from "../utils";

export default function CompletedPage() {
  const { tasks, refreshTasks } = useDownloadTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);

  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "Completed"), [tasks]);

  // Close context menu
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const filtered = useMemo(() => {
    let result = completedTasks;
    if (filter) {
      const q = filter.toLowerCase();
      result = result.filter((t) => t.filename.toLowerCase().includes(q));
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortKey === "filename") cmp = a.filename.localeCompare(b.filename);
        else if (sortKey === "total_bytes") cmp = a.total_bytes - b.total_bytes;
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [completedTasks, filter, sortKey, sortDirection]);

  const selectedTask = filtered.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    const handler = () => setSelectedId(null);
    window.addEventListener("deselect-item", handler);
    return () => window.removeEventListener("deselect-item", handler);
  }, []);

  const handleClearAll = async () => {
    try {
      await downloadsApi.clearCompletedDownloads();
      refreshTasks();
      setSelectedId(null);
    } catch { /* ignore */ }
  };

  const columns: Column<DownloadTask>[] = [
    {
      key: "filename",
      header: "Name",
      width: "1fr",
      sortable: true,
      render: (t) => <div className="text-[15px] font-medium text-[#f1f5f9] truncate">{t.filename}</div>,
    },
    {
      key: "total_bytes",
      header: "Size",
      width: "100px",
      sortable: true,
      render: (t) => <span className="text-[14px] text-[#94a3b8]">{formatBytes(t.total_bytes)}</span>,
    },
    {
      key: "destination",
      header: "Destination",
      width: "0.5fr",
      render: (t) => <span className="text-[13px] text-[#64748b] truncate block">{t.destination || "--"}</span>,
    },
    {
      key: "actions",
      header: "",
      width: "70px",
      render: (t) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setContextMenu({ x: e.clientX, y: e.clientY, taskId: t.id });
            }}
            className="w-[30px] h-[30px] rounded-md flex items-center justify-center text-[#64748b]"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            ···
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <TableToolbar
        title="Completed"
        subtitle={`${completedTasks.length} download${completedTasks.length !== 1 ? "s" : ""}`}
        filterPlaceholder="Filter completed..."
        filterValue={filter}
        onFilterChange={setFilter}
        actions={
          completedTasks.length > 0 ? (
            <button
              onClick={handleClearAll}
              className="text-[#475569] hover:text-[#94a3b8] text-[14px] transition-colors"
            >
              Clear All
            </button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(t) => t.id}
        onRowClick={(t) => setSelectedId(t.id)}
        selectedId={selectedId}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
        emptyMessage="No completed downloads"
        emptySubtext="Downloads will appear here once they finish."
      />

      {/* Slide-over */}
      <SlideOverPanel open={!!selectedTask} onClose={() => setSelectedId(null)}>
        {selectedTask && (
          <>
            {/* Header */}
            <div className="px-6 py-5 border-b border-[rgba(255,255,255,0.06)] flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-[18px] font-bold text-[#f1f5f9] leading-snug break-words">
                  {selectedTask.filename}
                </h3>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748b] hover:text-[#f1f5f9] shrink-0"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Checkmark */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-full bg-[rgba(16,185,129,0.12)] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-[15px] text-[#10b981] font-medium">Download complete</span>
              </div>

              {/* Info cards */}
              <div className="flex flex-col gap-2.5">
                <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                  <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Size</div>
                  <div className="text-[17px] text-[#f1f5f9] font-semibold">{formatBytes(selectedTask.total_bytes)}</div>
                </div>
                {selectedTask.destination && (
                  <div className="bg-[rgba(255,255,255,0.03)] rounded-[10px] p-3.5">
                    <div className="text-[11px] text-[#475569] uppercase tracking-[0.5px] mb-1.5">Saved to</div>
                    <div className="text-[15px] text-[#f1f5f9] font-medium break-all">{selectedTask.destination}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[rgba(255,255,255,0.06)] flex gap-2.5">
              {selectedTask.destination && (
                <button
                  onClick={() => openPath(selectedTask.destination).catch(() => {})}
                  className="flex-1 py-3 rounded-[10px] text-white text-[15px] font-semibold transition-colors"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                >
                  Reveal in Finder
                </button>
              )}
              <button
                onClick={() => { setSelectedId(null); handleClearAll(); }}
                className="py-3 px-5 rounded-[10px] text-[#ef4444] text-[14px] transition-colors"
                style={{ background: "rgba(239,68,68,0.06)" }}
              >
                Remove
              </button>
            </div>
          </>
        )}
      </SlideOverPanel>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#0f0f18] border border-[rgba(255,255,255,0.06)] rounded-lg py-1.5 w-52 z-[60] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {(() => {
            const menuTask = filtered.find((t) => t.id === contextMenu.taskId);
            return (
              <>
                {menuTask?.destination && (
                  <button
                    className="w-full text-left px-4 py-2.5 text-[15px] text-[#f1f5f9] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                    onClick={() => { setContextMenu(null); openPath(menuTask.destination).catch(() => {}); }}
                  >
                    Reveal in Finder
                  </button>
                )}
                <button
                  className="w-full text-left px-4 py-2.5 text-[15px] text-[#ef4444] cursor-pointer hover:bg-[rgba(255,255,255,0.04)] transition-colors"
                  onClick={() => { setContextMenu(null); handleClearAll(); }}
                >
                  Remove
                </button>
              </>
            );
          })()}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/CompletedPage.tsx
git commit -m "feat: implement CompletedPage with DataTable + SlideOverPanel"
```

---

## Chunk 4: Cleanup + Verification

### Task 12: Remove old components

**Files:**
- Delete: `src/components/IconRail.tsx`
- Delete: `src/components/MasterDetail.tsx`
- Delete: `src/components/StatsDashboard.tsx`
- Delete: `src/components/TorrentDetail.tsx`

- [ ] **Step 1: Verify no remaining imports of old components**

Search the codebase for imports of the four files being deleted. The only references should be in the files themselves (they should not be imported anywhere now that Layout, TorrentsPage, and DownloadsPage have been rewritten).

Run: `grep -r "IconRail\|MasterDetail\|StatsDashboard\|TorrentDetail" src/ --include="*.tsx" --include="*.ts" -l`

Expected: Only the four files themselves (if any). If other files still import them, fix those imports first.

- [ ] **Step 2: Delete old components**

```bash
rm src/components/IconRail.tsx src/components/MasterDetail.tsx src/components/StatsDashboard.tsx src/components/TorrentDetail.tsx
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 4: Commit**

```bash
git add -u src/components/
git commit -m "chore: remove IconRail, MasterDetail, StatsDashboard, TorrentDetail"
```

---

### Task 13: Remove unused hook

**Files:**
- Delete: `src/hooks/useDownloadProgress.ts` (replaced by useDownloadTasks.tsx which handles progress internally)

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "useDownloadProgress" src/ --include="*.tsx" --include="*.ts" -l`

Expected: Only `src/hooks/useDownloadProgress.ts` itself.

- [ ] **Step 2: Delete**

```bash
rm src/hooks/useDownloadProgress.ts
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: Clean pass

- [ ] **Step 4: Commit**

```bash
git add -u src/hooks/
git commit -m "chore: remove unused useDownloadProgress hook"
```

---

### Task 14: Final verification

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: Clean pass with zero errors

- [ ] **Step 2: Dev server smoke test**

Run: `npm run tauri dev`

Verify:
1. App launches with new sidebar layout (labeled nav on the left)
2. Torrents page shows sortable table — click column headers to sort
3. Filter input filters torrents by name
4. Click a torrent row — slide-over panel appears from the right
5. Slide-over shows torrent info, files with checkboxes, Download/Delete buttons
6. Click scrim or X to close slide-over
7. Downloads page shows active downloads with progress bars
8. Completed page shows finished downloads
9. Cmd+K opens command palette
10. Settings accessible from sidebar
11. Context menu works on right-click

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address UI issues found during smoke test"
```
