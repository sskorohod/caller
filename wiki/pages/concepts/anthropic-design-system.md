---
title: Anthropic Design System
type: concept
created: 2026-04-16
updated: 2026-04-16
tags: [design, ui, frontend, admin-panel]
sources: []
---

# Anthropic Design System

Warm, editorial-inspired design system used for the [[caller-platform]] admin panel. Based on Claude/Anthropic visual language — parchment tones, terracotta accents, serif typography, and ring-based shadows.

## Color Palette

### Light Theme
| Token | Value | Name |
|-------|-------|------|
| `--th-page` | `#f5f4ed` | Parchment |
| `--th-card` | `#faf9f5` | Ivory |
| `--th-surface` | `#e8e6dc` | Warm Sand |
| `--th-text` | `#141413` | Near Black |
| `--th-text-secondary` | `#5e5d59` | Olive Gray |
| `--th-text-muted` | `#87867f` | Stone Gray |
| `--th-border` | `#f0eee6` | Border Cream |
| `--th-primary` | `#c96442` | Terracotta |

### Dark Theme
| Token | Value | Name |
|-------|-------|------|
| `--th-page` | `#141413` | Near Black |
| `--th-card` | `#1c1c1a` | Dark Card |
| `--th-surface` | `#30302e` | Dark Surface |
| `--th-primary` | `#d97757` | Coral |

## Typography

- **Headlines**: Georgia, 'Times New Roman', serif — weight 500, line-height 1.10-1.30
- **Body**: system-ui, -apple-system, 'Inter', sans-serif — line-height 1.60
- **Labels**: 10px, uppercase, tracking-wider, Stone Gray

## Shadow System

No gradients. Ring-based shadows instead:
- **Ring**: `0px 0px 0px 1px var(--th-ring)` — subtle border effect
- **Whisper**: `rgba(0,0,0,0.05) 0px 4px 24px` — soft card elevation
- **Focus**: `0px 0px 0px 2px var(--th-primary)` — focus ring on inputs

## Components

11 shared components in `packages/frontend/src/app/admin/_components/`:

| Component | Purpose |
|-----------|---------|
| `AdminKpiCard` | KPI metric cards with icon, value, label |
| `AdminTable` | Paginated data tables with mobile card view |
| `AdminChart` | Smooth SVG curves (Catmull-Rom splines) |
| `AdminModal` | Dialogs with escape/overlay close |
| `AdminBadge` | Status badges (success, warning, error, info) |
| `AdminFilterBar` | Pill-style filter buttons |
| `AdminFormField` | Form field wrapper with label and hint |
| `AdminSplitView` | List + detail responsive layout |
| `AdminPageHeader` | Page header with icon, title, subtitle |
| `AdminLoadingState` | Skeleton loading animation |
| `AdminErrorState` | Error display with retry button |

## CSS Scoping

All admin styles scoped via `[data-admin]` selector in `globals.css`. This isolates the Anthropic palette to admin pages — the user dashboard retains its separate indigo-based design.

## Cross-References

- [[caller-platform]] — admin panel uses this design system
