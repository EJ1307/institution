// Formatting helpers: amounts in US dollars, short dates.

const usd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-US");

/** $123,456 */
export function dollars(n: number): string {
  return `$${usd.format(Math.round(n))}`;
}

/** $4.25M · $386K · $92.5K · $640 */
export function dollarsCompact(n: number, digits = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}$${trim((abs / 1e9).toFixed(digits + 1))}B`;
  if (abs >= 1e6) return `${sign}$${trim((abs / 1e6).toFixed(digits + 1))}M`;
  if (abs >= 1e3) return `${sign}$${trim((abs / 1e3).toFixed(digits))}K`;
  return `${sign}$${Math.round(abs)}`;
}

function trim(s: string) {
  return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function number(n: number): string {
  return num.format(n);
}

export function percent(n: number, digits = 1): string {
  return `${trim((n * 100).toFixed(digits))}%`;
}

const dShort = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const dLong = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dWeek = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
const dWeekLong = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long" });
const dMonth = new Intl.DateTimeFormat("en-IN", { month: "short" });
const dMonthYear = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const tShort = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

/** 5 Oct */
export const fmtDay = (d: Date) => dShort.format(d);
/** 5 Oct 2026 */
export const fmtDate = (d: Date) => dLong.format(d);
/** Mon, 5 Oct */
export const fmtWeekday = (d: Date) => dWeek.format(d);
/** Monday, 5 October */
export const fmtWeekdayLong = (d: Date) => dWeekLong.format(d);
/** Oct */
export const fmtMonth = (d: Date) => dMonth.format(d);
/** October 2026 */
export const fmtMonthYear = (d: Date) => dMonthYear.format(d);
/** 9:40 am */
export const fmtTime = (d: Date) => tShort.format(d).replace(" ", " ").toLowerCase();

/** "8:10" style 24h string → "8:10 am" */
export function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function relativeDays(d: Date, today: Date): string {
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(today).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -7) return `${-diff} days ago`;
  return fmtDay(d);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function initials(name: string): string {
  const parts = name
    .replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${number(n)} ${n === 1 ? one : many}`;
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
