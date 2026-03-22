# Settings Page Redesign — Design Spec

## Overview

Redesign the Settings page from a flat single-column scroll to a two-column layout inspired by macOS System Settings. Left sidebar with icon + text category navigation, right panel with grouped setting cards. Clicking a category scrolls the right panel to that section; the active category highlights as the user scrolls.

## Motivation

The current Settings page is a long single-column scroll with flat visual hierarchy. All sections (Provider, Downloads, Trackers, Behavior, Appearance) run together with minimal visual distinction between them. The redesign adds structure, grouping, and better navigation.

## Design

### Layout Structure

Two-column layout inside the existing main content area (to the right of the app's sidebar):

- **Left column (200px fixed):** Category navigation list with icons. Full height, does not scroll independently.
- **Right column (flex-1):** Scrollable content area with all settings sections stacked vertically. Sections are separated by horizontal divider lines between them. Within each section, related settings are grouped into bordered cards with internal row dividers.

### Category Navigation (Left Column)

Five categories, each with an icon and label:

1. **General** (gear icon) — Provider selection (renamed from "Debrid Provider" to be shorter for sidebar display; only contains provider selector)
2. **Downloads** (download icon) — Folder, concurrent downloads, subfolders, auto-start
3. **Trackers** (search icon) — Tracker list, add/remove trackers
4. **Behavior** (inbox icon) — Launch at login, magnet handler, notifications, sort order
5. **Appearance** (palette icon) — Theme mode, accent color

Active category is highlighted with the accent color background and text. As the user scrolls the right panel, the active category updates to match the visible section (scroll spy).

Clicking a category smooth-scrolls the right panel to that section.

### Setting Cards (Right Column)

Each section has:
- **Section header** — 18px semibold title
- **Section description** — 13px muted subtitle
- **Setting card** — Grouped card with `background: var(--theme-bg)`, `border: 1px solid var(--theme-border)`, `border-radius: 12px`. Multiple settings within a card are separated by a 1px `border-top` divider between rows.

Each setting row inside a card has:
- Left: label (14px) + optional sublabel (12px muted)
- Right: control (toggle, select dropdown, browse button, etc.)
- Padding: 16px 20px per row

### Preserved Behaviors

The following existing behaviors must be preserved in the rewrite:

- **"Saved" indicator:** The `savedField` state pattern that flashes "Saved" text next to a field for 1.5 seconds after a change is applied.
- **Loading state:** Full-area spinner shown while settings are loading. In the two-column layout, show the spinner centered in the full content area (no sidebar visible during loading).
- **Error state:** "Failed to load settings" message. Same treatment — centered in full content area.
- **Provider switching:** The `switching` disabled state and potential `window.location.reload()` when switching to a provider without saved credentials. Provider buttons show reduced opacity while switching.

### Section Details

**General:**
- Provider selector: two side-by-side buttons (Real-Debrid / TorBox), active one has accent border + tint. Shows disabled/opacity state while switching.

**Downloads:**
- Single card containing 4 rows:
  - Download Folder: path display + Browse button (with "Saved" indicator support)
  - Max Concurrent Downloads: dropdown select (with "Saved" indicator support)
  - Create subfolders per torrent: toggle (with "Saved" indicator support)
  - Auto-start downloads: toggle

**Trackers:**
- Card with existing trackers as rows. Each row contains: small toggle switch, tracker name, tracker URL (truncated), type badge (`API` / `Torznab` / `Prowlarr`), Remove button.
- If no trackers configured: empty state with dashed border and "No trackers configured" message.
- Below the card: a dashed-border "+ Add Tracker" button.
- Clicking it expands an inline form with: name input, type dropdown (`piratebay_api` / `torznab` / `prowlarr`), URL input (placeholder changes per type), API key input (placeholder changes per type), Add button.
- Below the form inputs: the existing "How it works" help panel with type-specific instructions (TPB-style API format, Torznab endpoint format, Prowlarr instructions).
- Torznab shows API key warning when key is empty.
- Form collapses after successfully adding a tracker.

**Behavior:**
- Single card containing 4 rows:
  - Launch at login: toggle
  - Default magnet link handler: toggle
  - Notify when download completes: toggle
  - Default sort order: two dropdown selects side by side (sort key + direction)

**Appearance:**
- Theme: two side-by-side buttons (Dark / Light) with moon/sun icons, active one has accent border + tint.
- Accent Color: 3-column grid of color options. Each has a colored dot + label. Active one has accent-colored border, glow on the dot, and a checkmark. (This preserves the existing behavior.)

### Scroll Spy Behavior

Use `IntersectionObserver` on each section element with a threshold that activates the topmost visible section. When multiple sections are visible (e.g., in a tall window), the one closest to the top of the scroll container wins. Use `rootMargin: "-10% 0px -80% 0px"` to bias toward sections near the top of the viewport.

### Responsive Behavior

No responsive breakpoint needed. The app has a fixed minimum window size and the 200px sidebar + content area will always fit. If the window is narrow, the content area simply gets narrower — the sidebar stays.

## What Changes

### Modified files:
- `src/pages/SettingsPage.tsx` — Rewrite of the JSX layout from single-column to two-column. All state, handlers, effects, and logic remain unchanged. New additions: category nav component, scroll spy via IntersectionObserver, collapsible add-tracker form state, setting card grouping.

### No new files needed.
The `ToggleRow` component is refined to fit within card rows (less vertical margin, adapted padding). No new dependencies.

### No backend changes.

## Estimated Size

~200-300 lines of JSX changes (layout restructuring). Logic unchanged. Total file size should remain roughly the same since the flat layout code is replaced with the card layout code.
