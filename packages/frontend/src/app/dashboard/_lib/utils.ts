export function fmtDuration(sec: number | null) {
  if (!sec) return '\u2014';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtCost(v: number) {
  return v < 0.01 ? '$0.00' : `$${v.toFixed(2)}`;
}

export function fmtPhone(phone: string | null | undefined): string {
  if (!phone) return '\u2014';
  // Format US numbers: +18182775070 → +1 (818) 277-5070
  const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (match) return `+1 (${match[1]}) ${match[2]}-${match[3]}`;
  // Format other international: +7999... → +7 999...
  const intl = phone.match(/^\+(\d{1,3})(\d+)$/);
  if (intl) return `+${intl[1]} ${intl[2].replace(/(\d{3})(?=\d)/g, '$1 ')}`;
  return phone;
}

export function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
