"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { Menu } from "@/components/ui/overlay";
import { Button, cn } from "@/components/ui/primitives";
import { classGrid, currentSchoolDay, markFor, studentSummary, type DayCount, type Mark } from "@/lib/data/attendance";
import { academicYear, addDays, holidayName, isoDate, isSchoolDay, isWeekend, lastSchoolDay, nextSchoolDay, schoolDaysBack, schoolDaysBetween } from "@/lib/data/calendar";
import type { Student } from "@/lib/data/people";
import { fmtMonthYear, fmtWeekday } from "@/lib/format";
import { getState } from "@/lib/store";

// ——— Marks ————————————————————————————————————————————————————————

export const MARKS: Mark[] = ["P", "A", "L", "E"];

export const MARK_META: Record<Mark, { label: string; short: string; dot: string; soft: string; text: string; ring: string }> = {
  P: { label: "Present", short: "P", dot: "bg-good", soft: "bg-good-soft", text: "text-good", ring: "ring-good/30" },
  L: { label: "Late", short: "L", dot: "bg-[#D9961F]", soft: "bg-warn-soft", text: "text-warn", ring: "ring-warn/30" },
  A: { label: "Absent", short: "A", dot: "bg-bad", soft: "bg-bad-soft", text: "text-bad", ring: "ring-bad/30" },
  E: { label: "Leave", short: "Leave", dot: "bg-info", soft: "bg-info-soft", text: "text-info", ring: "ring-info/30" },
};

export function MarkBadge({ mark, className }: { mark: Mark | null; className?: string }) {
  if (!mark)
    return (
      <span className={cn("inline-flex h-[22px] items-center rounded-full border border-dashed border-line-strong px-2 text-[11.5px] font-medium text-muted", className)}>
        Not marked
      </span>
    );
  const m = MARK_META[mark];
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium whitespace-nowrap", m.soft, m.text, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {mark === "E" ? "On leave" : m.label}
    </span>
  );
}

/** Last N school days as tiny squares — a quick read of a student's recent pattern. */
export function MarkStrip({ student, days }: { student: Student; days: Date[] }) {
  return (
    <span className="inline-flex items-center gap-[3px]" role="img" aria-label={`Last ${days.length} school days`}>
      {days.map((d) => {
        const m = markFor(student, d);
        return (
          <span
            key={d.getTime()}
            title={`${fmtWeekday(d)} · ${m ? MARK_META[m].label : "Not marked"}`}
            className={cn("size-[9px] rounded-[2px]", m ? MARK_META[m].dot : "border border-dashed border-line-strong", m === "P" && "opacity-35")}
          />
        );
      })}
    </span>
  );
}

// ——— Dates ————————————————————————————————————————————————————————

/** Term to date: every school day from 1 April up to and including `day`. */
export function termDays(day: Date = currentSchoolDay()): Date[] {
  return schoolDaysBetween(academicYear(day).start, day);
}

/** Every school day in the academic year (for "can they still reach 75%?"). */
export function yearDays(day: Date = currentSchoolDay()): Date[] {
  const ay = academicYear(day);
  return schoolDaysBetween(ay.start, ay.end);
}

/** Parse ?date= — only school days on or before the current school day are allowed. */
export function parseDay(param: string | null): Date {
  const today = currentSchoolDay();
  if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return today;
  const [y, m, d] = param.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  if (Number.isNaN(x.getTime()) || x > today || !isSchoolDay(x) || x < academicYear(today).start) return today;
  return x;
}

// ——— Cached aggregates ——————————————————————————————————————————————
// A school-wide count touches every student; past days only change when a
// register for that date is saved in the demo store, so cache per day and
// invalidate on the identity of that date's saved registers.

function registersFor(test: (key: string) => boolean): unknown[] {
  const att = getState().attendance;
  const out: unknown[] = [];
  for (const k in att) if (test(k)) out.push(att[k]);
  return out;
}

const sameRefs = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export type ClassDayRow = ReturnType<typeof classGrid>[number];

const gridCache = new Map<string, { today: string; refs: unknown[]; grid: ClassDayRow[] }>();

/** Per-class counts for a day (the heatmap rows), cached per date. */
export function classGridCached(d: Date): ClassDayRow[] {
  const iso = isoDate(d);
  const today = isoDate(currentSchoolDay());
  const refs = registersFor((k) => k.endsWith(`|${iso}`));
  const hit = gridCache.get(iso);
  if (hit && hit.today === today && sameRefs(hit.refs, refs)) return hit.grid;
  const grid = classGrid(d);
  gridCache.set(iso, { today, refs, grid });
  return grid;
}

/** Add up per-class counts (e.g. a stage, or the whole school). */
export function sumCounts(rows: DayCount[]): DayCount {
  const c: DayCount = { present: 0, late: 0, absent: 0, leave: 0, total: 0, unmarked: 0, rate: 0 };
  for (const r of rows) {
    c.present += r.present;
    c.late += r.late;
    c.absent += r.absent;
    c.leave += r.leave;
    c.total += r.total;
    c.unmarked += r.unmarked;
  }
  const marked = c.total - c.unmarked;
  c.rate = marked ? (c.present + c.late) / marked : 0;
  return c;
}

export function schoolTrendCached(n: number, end: Date) {
  return schoolDaysBack(n, end).map((d) => ({ date: d, grid: classGridCached(d), ...sumCounts(classGridCached(d)) }));
}

const summaryCache = new Map<string, { today: string; refs: unknown[]; summary: DayCount }>();

/** Term-to-date summary for one student, cached across renders and pages. */
export function termSummaryCached(s: Student, end: Date): DayCount {
  const key = `${s.id}|${isoDate(end)}`;
  const today = isoDate(currentSchoolDay());
  const refs = registersFor((k) => k.startsWith(`${s.classKey}|`));
  const hit = summaryCache.get(key);
  if (hit && hit.today === today && sameRefs(hit.refs, refs)) return hit.summary;
  const summary = studentSummary(s, termDays(end));
  summaryCache.set(key, { today, refs, summary });
  return summary;
}

/** Consecutive school days a student has been away (A or leave), counting back from `day`. */
export function awayStreak(s: Student, day: Date, max = 15): { days: number; since: Date | null } {
  let n = 0;
  let since: Date | null = null;
  for (const d of [...schoolDaysBack(max, day)].reverse()) {
    const m = markFor(s, d);
    if (m === "A" || m === "E") {
      n++;
      since = d;
    } else break;
  }
  return { days: n, since };
}

/** Rate → status tone: below 75% is a CBSE eligibility problem, 75–85% is the watch list. */
export function rateTone(rate: number): "bad" | "warn" | "good" | "brand" {
  if (rate < 0.75) return "bad";
  if (rate < 0.85) return "warn";
  return "good";
}

// ——— School-day picker ————————————————————————————————————————————————

const WEEK_HEAD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Date control limited to school days: ‹ prev · date (opens a month calendar) · next ›. */
export function SchoolDayPicker({ value, onChange, min, max }: { value: Date; onChange: (d: Date) => void; min: Date; max: Date }) {
  const prev = lastSchoolDay(addDays(value, -1));
  const next = nextSchoolDay(value);
  const canPrev = prev >= min;
  const canNext = next <= max;
  return (
    <div className="inline-flex items-center rounded-lg border border-line-strong/80 bg-surface shadow-[0_1px_1px_rgb(0_0_0/0.03)]">
      <Button variant="ghost" size="icon-sm" className="rounded-r-none" onClick={() => onChange(prev)} disabled={!canPrev} aria-label="Previous school day">
        <ChevronLeft />
      </Button>
      <Menu
        width={284}
        align="end"
        label="Pick a school day"
        trigger={({ toggle, ref, open }) => (
          <button
            ref={ref}
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="dialog"
            className="inline-flex h-8 items-center gap-2 border-x border-line px-3 text-[13px] font-medium text-ink hover:bg-surface-2"
          >
            <CalendarDays className="size-4 text-muted" aria-hidden />
            <span className="tnum">{fmtWeekday(value)}</span>
          </button>
        )}
      >
        {(close) => <MonthPicker value={value} min={min} max={max} onPick={(d) => (onChange(d), close())} />}
      </Menu>
      <Button variant="ghost" size="icon-sm" className="rounded-l-none" onClick={() => onChange(next)} disabled={!canNext} aria-label="Next school day">
        <ChevronRight />
      </Button>
    </div>
  );
}

function MonthPicker({ value, min, max, onPick }: { value: Date; min: Date; max: Date; onPick: (d: Date) => void }) {
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const first = month;
  const lead = (first.getDay() + 6) % 7;
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
  const canPrev = new Date(first.getFullYear(), first.getMonth(), 0) >= min;
  const canNext = new Date(first.getFullYear(), first.getMonth() + 1, 1) <= max;
  return (
    <div className="p-2">
      <div className="mb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" disabled={!canPrev} onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))} aria-label="Previous month">
          <ChevronLeft />
        </Button>
        <span className="text-[13px] font-semibold">{fmtMonthYear(first)}</span>
        <Button variant="ghost" size="icon-sm" disabled={!canNext} onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))} aria-label="Next month">
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEK_HEAD.map((w) => (
          <span key={w} className="pb-1 text-[10.5px] font-semibold tracking-[0.04em] text-faint uppercase">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`x${i}`} />;
          const school = isSchoolDay(d);
          const inRange = d >= min && d <= max;
          const selected = isoDate(d) === isoDate(value);
          const hol = !isWeekend(d) ? holidayName(d) : null;
          return (
            <button
              key={d.getDate()}
              type="button"
              disabled={!school || !inRange}
              onClick={() => onPick(d)}
              title={hol ?? undefined}
              aria-label={`${fmtWeekday(d)}${hol ? ` · ${hol}` : ""}`}
              aria-pressed={selected}
              className={cn(
                "tnum h-8 rounded-md text-[12.5px] transition-colors",
                selected ? "bg-brand font-semibold text-white" : school && inRange ? "text-ink hover:bg-ink/[0.06]" : "text-faint/70",
                hol && !selected && "underline decoration-dotted underline-offset-2",
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <p className="mt-2 border-t border-line px-1 pt-2 text-[11.5px] text-muted">Weekends and school holidays are greyed out.</p>
    </div>
  );
}

/** true when the viewport is at least `minWidth` px wide (for chart density). */
export function useWide(minWidth = 640) {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [minWidth]);
  return wide;
}
