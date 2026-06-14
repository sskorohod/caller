// First-party, anonymous site analytics tracker — PUBLIC pages only.
// No PII: visitor_id is a random local id. Never runs on /dashboard or /admin.
// Events are batched and flushed with sendBeacon so closing the tab keeps data.

type Ev = {
  type: string;
  path: string;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  device?: string | null;
  viewport?: string | null;
  lang?: string | null;
  active_ms?: number;
  scroll_pct?: number;
  element_label?: string | null;
  element_selector?: string;
  x_pct?: number;
  y_px?: number;
};

const API = (process.env.NEXT_PUBLIC_API_URL || '/api') + '/analytics/collect';
const VID_KEY = 'lt_vid';
const SID_KEY = 'lt_sid';
const SID_TS = 'lt_sid_ts';
const SESSION_GAP = 30 * 60 * 1000;

let queue: Ev[] = [];
let started = false;
let curPath = '';
let activeMs = 0;
let lastTick = 0;
let visible = true;
let maxScroll = 0;

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const isPublic = (p: string) => !p.startsWith('/dashboard') && !p.startsWith('/admin');
const device = () => { const w = window.innerWidth; return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop'; };

function getVisitorId(): string {
  let v = localStorage.getItem(VID_KEY);
  if (!v) { v = rid(); try { localStorage.setItem(VID_KEY, v); } catch { /* ignore */ } }
  return v;
}
function getSessionId(): string {
  const now = Date.now();
  const ts = Number(sessionStorage.getItem(SID_TS) || 0);
  let sid = sessionStorage.getItem(SID_KEY);
  if (!sid || now - ts > SESSION_GAP) { sid = rid(); try { sessionStorage.setItem(SID_KEY, sid); } catch { /* ignore */ } }
  try { sessionStorage.setItem(SID_TS, String(now)); } catch { /* ignore */ }
  return sid;
}
function utm() {
  const p = new URLSearchParams(location.search);
  return { utm_source: p.get('utm_source'), utm_medium: p.get('utm_medium'), utm_campaign: p.get('utm_campaign') };
}

function enqueue(e: Ev) { queue.push(e); if (queue.length >= 20) flush(); }

function flush(useBeacon = false) {
  if (!queue.length) return;
  const body = JSON.stringify({ visitor_id: getVisitorId(), session_id: getSessionId(), events: queue });
  queue = [];
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(API, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* analytics must never break the site */ }
}

function tickActive() { const now = Date.now(); if (visible && lastTick) activeMs += now - lastTick; lastTick = now; }

function flushEngage() {
  tickActive();
  if (curPath && isPublic(curPath)) {
    if (activeMs > 500) enqueue({ type: 'engage', path: curPath, active_ms: Math.min(activeMs, 3_600_000) });
    if (maxScroll > 0) enqueue({ type: 'scroll', path: curPath, scroll_pct: Math.min(100, Math.round(maxScroll)) });
  }
  activeMs = 0; maxScroll = 0;
}

function cssPath(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  if (el.id) return `${tag}#${el.id}`;
  const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  return cls ? `${tag}.${cls}` : tag;
}

function onClick(ev: MouseEvent) {
  if (!curPath || !isPublic(curPath)) return;
  const t = (ev.target as HTMLElement)?.closest('a,button,[role="button"],[data-track]') as HTMLElement | null;
  if (!t) return;
  const label = (t.getAttribute('aria-label') || t.textContent || t.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const w = window.innerWidth || 1;
  const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1);
  enqueue({
    type: 'click', path: curPath, element_label: label || null, element_selector: cssPath(t),
    device: device(), viewport: device(),
    x_pct: Math.max(0, Math.min(10000, Math.round((ev.clientX / w) * 10000))),
    y_px: Math.max(0, Math.min(h, Math.round(ev.clientY + window.scrollY))),
  });
}
function onScroll() {
  if (!curPath || !isPublic(curPath)) return;
  const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, 1);
  const p = ((window.scrollY + window.innerHeight) / h) * 100;
  if (p > maxScroll) maxScroll = Math.min(100, p);
}
function onVis() { visible = document.visibilityState === 'visible'; if (!visible) { flushEngage(); flush(true); } else { lastTick = Date.now(); } }
function onHide() { flushEngage(); flush(true); }

function startListeners() {
  started = true;
  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onHide);
  setInterval(() => { tickActive(); flush(); }, 15_000);
}

/** Record a pageview / SPA route change. Flushes the prior page's engage+scroll. */
export function trackPageview(path: string) {
  if (typeof window === 'undefined') return;
  if (!started) startListeners();
  if (curPath && curPath !== path) flushEngage();
  curPath = path; activeMs = 0; maxScroll = 0; lastTick = Date.now(); visible = document.visibilityState === 'visible';
  if (!isPublic(path)) return;
  enqueue({
    type: 'pageview', path, referrer: document.referrer || null, ...utm(),
    device: device(), viewport: device(), lang: navigator.language?.slice(0, 16) || null,
  });
}

/** Fire a custom conversion event (e.g. 'signup') bound to the current page. */
export function trackEvent(type: string) {
  if (typeof window === 'undefined' || !curPath || !isPublic(curPath)) return;
  enqueue({ type, path: curPath });
  flush();
}
