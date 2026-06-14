# Site Analytics & Behavior — Admin Section (in-house) — Design

Date: 2026-06-13
Status: Approved (owner delegated final approach to maximize analytics value)

## Goal

Give the platform admin a dedicated **"Analytics / Behavior"** section in the admin
panel showing how visitors behave on the **public site/landing**: how many come,
how many are active, how long they stay, where their attention goes (scroll +
click heatmaps), which buttons they press, where they come from, and where they
drop off before signup.

## Constraints & decisions

- **In-house only.** All data lives in our own Postgres / stack. No third-party
  analytics for this data (rules out Microsoft Clarity = data leaves; GA4 already
  runs via GTM but its data is not surfaced in our admin and lacks heatmaps).
- **Mac mini stack.** No heavy infra (rules out self-hosted PostHog/ClickHouse).
  Heatmaps are rendered by overlaying on the **live page in an iframe** — no
  headless-Chromium screenshots on the backend.
- **Public site/landing only.** The authenticated dashboard is NOT tracked.
- **First-party & anonymous.** Random `visitor_id`, no PII. IP not stored raw
  (hashed or country-only). EU cookie/consent banner is a noted follow-up, not in
  scope for v1.

## Non-goals (v1)

- Dashboard (authenticated app) tracking.
- Full session video recording.
- Mouse-move heatmaps (deferred to v2 — high data volume on the Mac mini).
- Any third-party/cloud analytics dependency.

## Architecture

Four units, each independently testable:

### 1. Client tracker (`packages/frontend` — public pages only)
A small client module mounted in the **public** layout (NOT in `dashboard/` or
`admin/`). Responsibilities:
- Assign a persistent anonymous `visitor_id` (localStorage) and a `session_id`
  (sessionStorage, 30-min sliding window).
- Emit events, **batched** and flushed via `navigator.sendBeacon` on
  `visibilitychange`/`pagehide` (so closing the tab does not lose data):
  - `pageview` — path, referrer, UTM (source/medium/campaign), device type,
    viewport bucket (desktop/tablet/mobile), language.
  - `engage` — active time on page in ms (counts only while the tab is visible),
    flushed on leave → time-on-page and session duration.
  - `click` — for buttons/links: element text/label + a stable CSS selector +
    **normalized coordinates** (`x_pct` = clientX / contentWidth, `y_px` =
    absolute document Y) + viewport bucket → powers the click heatmap AND the
    top-clicked-elements report.
  - `scroll` — max scroll depth (%) reached on the page → scroll/attention map.
- Honors `navigator.doNotTrack` (configurable). Sends nothing on the dashboard.

### 2. Ingestion endpoint (`packages/backend`)
- `POST /api/analytics/collect` — **public, no auth** (it serves the public
  site), **per-IP rate-limited**, Zod-validated batch body, basic bot filtering
  (UA + missing-beacon heuristics). Writes rows to the tables below. IP is hashed
  (or reduced to country) before storage; never stored raw.

### 3. Data model (`supabase/migrations` + `db/schema.ts`)
- `analytics_events` — id, visitor_id, session_id, type (`pageview|engage|click|
  scroll`), path, referrer, utm_source, utm_medium, utm_campaign, device,
  viewport, lang, active_ms, scroll_pct, element_label, element_selector,
  created_at. Indexes: (created_at), (type, created_at), (path, created_at).
- `analytics_heatmap_points` — id, path, viewport, x_pct, y_px, created_at.
  Separate table for the high-volume click-coordinate stream; indexed by
  (path, viewport, created_at).
- Daily rollup table is a v2 optimization (only if volume warrants); v1 queries
  the raw tables with date filters (traffic is modest today).
- Server-side `signup` conversion event: the backend emits an analytics row on
  successful registration (no PII — visitor linkage via a client-sent id on the
  register call) so the funnel's final step is accurate.

### 4. Admin API + UI (`/api/admin/analytics/*` + `/admin/analytics`)
- API (all under `requireAdmin`), period-filtered (reuse `AdminPeriodFilter`):
  - `overview` — visits, unique visitors, active-now (last 5 min), sessions,
    avg session duration, avg time on page.
  - `timeseries` — visits/visitors over time (for `AdminChart`).
  - `pages` — top pages: views, avg time, avg scroll depth (attention).
  - `clicks` — top clicked elements (label + page + count).
  - `heatmap?path=&viewport=` — aggregated click points + scroll distribution
    for a page.
  - `sources` — referrers + UTM breakdown.
  - `devices` — device/browser split.
  - `funnel` — landing → /login → signup (drop-off at each step).
- UI: new `/admin/analytics` page + a nav entry, built on existing admin
  components (`AdminKpiCard`, `AdminChart`, `AdminTable`, `AdminPeriodFilter`,
  `AdminFunnel`). Tabs:
  - **Overview** — KPI cards + visits-over-time chart + sources + devices.
  - **Pages** — table: path, views, avg time, scroll depth.
  - **Heatmaps** — page + device + period selectors → the live public page in an
    **iframe** at the chosen viewport width, with a `heatmap.js` canvas overlay
    rendering aggregated click density + a scroll-reach gradient.
  - **Funnel** — landing → login → signup conversion.

## Data flow

public page → client tracker (batch) → `POST /api/analytics/collect` (rate-limit,
validate, hash IP, bot-filter) → `analytics_events` / `analytics_heatmap_points`
→ admin opens `/admin/analytics` → `/api/admin/analytics/*` (requireAdmin,
aggregate) → admin components render; Heatmaps tab overlays canvas on a live
same-origin iframe.

## Phasing

- **v1 (this build):** tracker (pageview/engage/click/scroll) + ingestion + tables
  + admin API + admin UI with Overview, Pages, **click heatmap + scroll map**,
  top buttons, sources, devices, and the signup funnel.
- **v2 (later):** sampled mouse-move heatmaps, pseudo-session timelines, country
  geo, daily rollups if volume grows, EU consent banner.

## Privacy

First-party, anonymous (random visitor id, no PII), IP hashed/country-only,
optional DNT honoring. EU consent banner flagged as a follow-up (anonymous
first-party analytics is lower-risk but not automatically exempt).

## Error handling & resilience

- Ingestion failures are silent on the client (analytics must never break the
  site); events are best-effort.
- Rate-limit + body-size cap + bot filter protect the public endpoint.
- Heatmap iframe is same-origin; if a page can't be framed, the tab degrades to
  a coordinate-list/aggregate view.

## Success criteria

Admin can, for a chosen period: see visits / unique / active-now / avg time; see
per-page time + scroll depth; view a click heatmap and scroll map overlaid on the
real landing; see the top clicked buttons; see traffic sources and devices; and
read the landing→login→signup funnel — all from data stored only in our own DB.

## Honest limitation

Click + scroll heatmaps are good; this is not session-recording quality (that's
what dedicated tools do). Trade-off accepted for full data ownership in our stack.
