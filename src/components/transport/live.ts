// Live-tracking helpers on top of the simulated bus clock in lib/data/transport.

import { useEffect, useState } from "react";
import { holidayName, isSchoolDay, isWeekend } from "@/lib/data/calendar";
import { students, type Student } from "@/lib/data/people";
import { busStatus, type BusStatus, type Route } from "@/lib/data/transport";
import { hash01, hashInt } from "@/lib/rng";
import { fmtTime } from "@/lib/format";

export type Run = "am" | "pm";

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** The same calendar day as `day`, at `mins` minutes past midnight. */
export function atMinutes(day: Date, mins: number) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + mins * 60000);
}

export const clock = (mins: number, day = new Date()) => fmtTime(atMinutes(day, mins));

/** Re-render on an interval (live views update every few seconds). */
export function useTicker(ms = 5000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export type Live = BusStatus & {
  /** where the bus is along the route in morning order (0 = first pickup, n-1 = school) */
  position: number | null;
  run: Run | null;
  /** no service today: weekend or holiday */
  closed: string | null;
};

/**
 * busStatus for any day. Today it is exactly the live clock; earlier days get
 * their own traffic (a small per-day shift) so the trip history isn't identical.
 */
export function simStatus(route: Route, t: Date): BusStatus {
  const jitter = t.toDateString() === new Date().toDateString() ? 0 : (hashInt("traffic", route.id, t.toDateString()) % 7) - 1;
  return busStatus(route, new Date(t.getTime() - jitter * 60000));
}

export function liveStatus(route: Route, now: Date): Live {
  if (!isSchoolDay(now)) {
    const name = isWeekend(now) ? null : holidayName(now);
    return { phase: "parked", lastStop: -1, t: 0, delay: 0, label: name ? `No service · ${name}` : "No service today", position: null, run: null, closed: name ?? "Weekend" };
  }
  const s = simStatus(route, now);
  const n = route.stops.length;
  if (s.phase === "morning") return { ...s, position: Math.min(n - 1, s.lastStop + s.t), run: "am", closed: null };
  if (s.phase === "afternoon") return { ...s, position: Math.max(0, n - 1 - (s.lastStop + s.t)), run: "pm", closed: null };
  return { ...s, position: null, run: null, closed: null };
}

export const onRoad = (l: Live) => l.phase === "morning" || l.phase === "afternoon";

/** Start and end of each run in minutes, as scheduled. */
export function runWindow(route: Route, run: Run) {
  const first = route.stops[0];
  const school = route.stops[route.stops.length - 1];
  return run === "am" ? { start: toMin(first.am), end: toMin(school.am) } : { start: toMin(school.pm), end: toMin(first.pm) };
}

/**
 * When the bus actually reached each stop on a run (morning order indices),
 * replayed minute by minute from the simulated clock. Future stops are null.
 */
export function runLog(route: Route, day: Date, run: Run, until: Date = new Date()): (Date | null)[] {
  const n = route.stops.length;
  const out: (Date | null)[] = Array(n).fill(null);
  if (!isSchoolDay(day)) return out;
  const { start, end } = runWindow(route, run);
  const phase = run === "am" ? "morning" : "afternoon";
  let seen = false;
  for (let m = start - 2; m <= end + 12; m++) {
    const t = atMinutes(day, m);
    if (t > until) break;
    const s = simStatus(route, t);
    if (s.phase === phase) {
      seen = true;
      for (let j = 0; j <= s.lastStop; j++) {
        const idx = run === "am" ? j : n - 1 - j;
        if (!out[idx]) out[idx] = t;
      }
    } else if (seen) {
      for (let j = 0; j < n; j++) if (!out[j]) out[j] = t;
      break;
    }
  }
  return out;
}

/** Scheduled time at a stop (morning-order index) plus the current delay. */
export function etaAt(route: Route, idx: number, run: Run, delay: number) {
  const st = route.stops[idx];
  return toMin(run === "am" ? st.am : st.pm) + delay;
}

const sectorOf = (name: string) => Number(/Sector (\d+)/.exec(name)?.[1] ?? NaN);

/**
 * The stop a family boards at. Most board at a stop in or next to their own
 * sector; the rest live between stops. Siblings share a stop.
 */
export function stopIndexFor(s: Student, route: Route) {
  const all = route.stops.slice(0, -1).map((_, i) => i); // the school is the last stop
  const home = sectorOf(s.locality);
  const near = all.filter((i) => {
    const name = route.stops[i].name;
    return name.startsWith(s.locality) || Math.abs(sectorOf(name) - home) <= 2;
  });
  const pool = near.length && hash01("near", s.parentId) < 0.7 ? near : all;
  return pool[Math.floor(hash01("stop-v2", s.parentId, route.id) * pool.length)];
}

export function ridersOn(route: Route) {
  return students().filter((s) => s.routeId === route.id);
}

/** Student count boarding at each stop (school excluded). */
export function stopCounts(route: Route) {
  const counts = Array(route.stops.length).fill(0) as number[];
  for (const s of ridersOn(route)) counts[stopIndexFor(s, route)]++;
  return counts;
}

/** Bus paperwork and the attendant's number: stable per route. */
export function busDetails(route: Route) {
  const h = (k: string) => hashInt("bus", route.id, k);
  const phone = `+91 9${String(h("att") % 1_000_000_000).padStart(9, "0").replace(/^(\d{4})(\d{5})$/, "$1 $2")}`;
  const model = `${route.capacity}-seater · CNG`;
  const year = 2019 + (h("yr") % 5);
  const days = (k: string, min: number, span: number) => min + (h(k) % span);
  return {
    attendantPhone: phone,
    model,
    year,
    docs: [
      { label: "Fitness certificate", inDays: days("fit", 70, 300) },
      { label: "Insurance", inDays: days("ins", 40, 280) },
      { label: "Pollution (PUC)", inDays: days("puc", 9, 150) },
      { label: "School-bus permit", inDays: days("permit", 120, 400) },
    ],
  };
}

export function ordinalStops(n: number) {
  return n === 1 ? "1 stop" : `${n} stops`;
}
