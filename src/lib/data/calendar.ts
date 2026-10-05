// Academic calendar: the demo is always "live" — it is anchored to the real
// current date, and the academic year (April → March) is derived from it.

import { startOfDay } from "@/lib/format";

export const DAY = 86400000;

export function today(): Date {
  return startOfDay(new Date());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function sameDay(a: Date, b: Date) {
  return isoDate(a) === isoDate(b);
}

/** Academic year containing `d`, e.g. { start: 1 Apr 2026, end: 31 Mar 2027, label: "2026–27" } */
export function academicYear(d: Date = today()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    startYear: y,
    start: new Date(y, 3, 1),
    end: new Date(y + 1, 2, 31),
    label: `${y}–${String(y + 1).slice(2)}`,
    nextLabel: `${y + 1}–${String(y + 2).slice(2)}`,
  };
}

type Holiday = { date: string; name: string };

// Festival dates move every year; known ones for the demo window, plus fixed national days.
const MOVABLE: Record<number, Holiday[]> = {
  2026: [
    { date: "2026-03-04", name: "Holi" },
    { date: "2026-08-28", name: "Raksha Bandhan" },
    { date: "2026-09-04", name: "Janmashtami" },
    { date: "2026-10-20", name: "Dussehra" },
    { date: "2026-11-06", name: "Diwali break" },
    { date: "2026-11-09", name: "Diwali break" },
    { date: "2026-11-10", name: "Bhai Dooj" },
    { date: "2026-11-24", name: "Guru Nanak Jayanti" },
  ],
  2027: [
    { date: "2027-03-22", name: "Holi" },
    { date: "2027-08-17", name: "Raksha Bandhan" },
    { date: "2027-08-25", name: "Janmashtami" },
    { date: "2027-10-11", name: "Dussehra" },
    { date: "2027-10-29", name: "Diwali break" },
    { date: "2027-11-01", name: "Diwali break" },
    { date: "2027-11-14", name: "Guru Nanak Jayanti" },
  ],
};

const FIXED: { md: string; name: string }[] = [
  { md: "01-26", name: "Republic Day" },
  { md: "08-15", name: "Independence Day" },
  { md: "10-02", name: "Gandhi Jayanti" },
  { md: "12-25", name: "Christmas" },
];

export function holidayName(d: Date): string | null {
  const iso = isoDate(d);
  const md = iso.slice(5);
  const fixed = FIXED.find((f) => f.md === md);
  if (fixed) return fixed.name;
  const movable = MOVABLE[d.getFullYear()]?.find((h) => h.date === iso);
  if (movable) return movable.name;
  const m = d.getMonth();
  const day = d.getDate();
  // Summer vacation 16 May – 30 June, winter break 26 Dec – 2 Jan
  if ((m === 4 && day >= 16) || m === 5) return "Summer vacation";
  if ((m === 11 && day >= 26) || (m === 0 && day <= 2)) return "Winter break";
  return null;
}

export function isWeekend(d: Date) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

export function isSchoolDay(d: Date) {
  return !isWeekend(d) && !holidayName(d);
}

/** The most recent school day on or before `d`. */
export function lastSchoolDay(d: Date = today()): Date {
  let x = startOfDay(d);
  for (let i = 0; i < 60 && !isSchoolDay(x); i++) x = addDays(x, -1);
  return x;
}

export function nextSchoolDay(d: Date = today()): Date {
  let x = addDays(startOfDay(d), 1);
  for (let i = 0; i < 60 && !isSchoolDay(x); i++) x = addDays(x, 1);
  return x;
}

/** `n` school days ending at (and including) `end`, oldest first. */
export function schoolDaysBack(n: number, end: Date = today()): Date[] {
  const out: Date[] = [];
  let x = lastSchoolDay(end);
  while (out.length < n) {
    if (isSchoolDay(x)) out.push(x);
    x = addDays(x, -1);
  }
  return out.reverse();
}

/** All school days from start to end inclusive. */
export function schoolDaysBetween(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  for (let x = startOfDay(start); x <= end; x = addDays(x, 1)) if (isSchoolDay(x)) out.push(x);
  return out;
}

/** Holidays (excluding weekends and long vacations) within a range — for calendars. */
export function holidaysBetween(start: Date, end: Date): { date: Date; name: string }[] {
  const out: { date: Date; name: string }[] = [];
  for (let x = startOfDay(start); x <= end; x = addDays(x, 1)) {
    const name = holidayName(x);
    if (name && !isWeekend(x)) out.push({ date: x, name });
  }
  return out;
}

/** Shift a date forward to a weekday school day if it lands on a weekend/holiday. */
export function toSchoolDay(d: Date): Date {
  return isSchoolDay(d) ? d : nextSchoolDay(d);
}
