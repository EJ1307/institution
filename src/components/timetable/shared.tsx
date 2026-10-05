"use client";

import { useState, type ReactNode } from "react";
import { Segmented } from "@/components/ui/forms";
import { cn } from "@/components/ui/primitives";
import { staff, staffById, type Staff } from "@/lib/data/people";
import { CLASSES, classLabel, PERIODS, SUBJECTS, TEACHING_PERIODS, WEEKDAYS } from "@/lib/data/school";
import { timetable } from "@/lib/data/timetable";
import { fmtClock } from "@/lib/format";

// ——— Subject tints ——————————————————————————————————————————————————
// Soft, low-chroma backgrounds with a slightly deeper edge. Related subjects
// share a family (sciences are teal-green, humanities terracotta) so a week
// reads as a pattern, not a rainbow.

export type Tint = { bg: string; edge: string };

const T = (bg: string, edge: string): Tint => ({ bg, edge });

export const SUBJECT_TINT: Record<string, Tint> = {
  mat: T("#EAEFF7", "#7C98C6"),
  eng: T("#E9F2EC", "#78AD8F"),
  hin: T("#FAF1DF", "#D2A85A"),
  evs: T("#EDF2E2", "#97AE6B"),
  sci: T("#E3F0EF", "#6FA7A2"),
  phy: T("#E3EEF2", "#6E9DB3"),
  che: T("#E5F0EA", "#73A88B"),
  bio: T("#E9F1E4", "#8DB07A"),
  sst: T("#F6EAE4", "#C98D74"),
  his: T("#F6EAE4", "#C98D74"),
  pol: T("#F4ECE6", "#BE9479"),
  eco: T("#F3EDE3", "#B89A6E"),
  acc: T("#EEEEE6", "#A3A07C"),
  bst: T("#F1EEE4", "#AE9F78"),
  psy: T("#F3EBEC", "#BD8C92"),
  skt: T("#F4EFE3", "#BBA06A"),
  fre: T("#EFEDF0", "#9C94A6"),
  cs: T("#ECEEF1", "#8C96A8"),
  pe: T("#F2F1EC", "#B5B0A3"),
  art: T("#F2F1EC", "#B5B0A3"),
  mus: T("#F2F1EC", "#B5B0A3"),
  lib: T("#F2F1EC", "#B5B0A3"),
  gk: T("#F2F1EC", "#B5B0A3"),
};

/** Names short enough for a timetable cell. */
const CELL_NAME: Record<string, string> = { pe: "Games", cs: "Computer Sc.", bst: "Business St.", pol: "Political Sc.", gk: "GK" };
export const cellSubject = (id: string) => CELL_NAME[id] ?? SUBJECTS[id]?.name ?? id;

export const tintFor = (subject: string) => SUBJECT_TINT[subject] ?? T("#F2F1EC", "#B5B0A3");

/** "8-B" → "VIII-B" */
export function labelOf(classKey: string) {
  const c = CLASSES.find((x) => x.key === classKey);
  return c ? classLabel(c.grade, c.section) : classKey;
}

/** "Ms. K. Iyer" */
export function teacherShort(s: Staff | undefined | null) {
  if (!s) return "—";
  return `${s.title} ${s.firstName[0]}. ${s.lastName}`;
}

// ——— Who is busy when ————————————————————————————————————————————————

let _busy: Map<string, (string | null)[][]> | null = null;

/** teacherId → [day][period] → classKey or null (from the generated timetable). */
export function busyIndex() {
  if (_busy) return _busy;
  const m = new Map<string, (string | null)[][]>();
  for (const [classKey, days] of Object.entries(timetable())) {
    days.forEach((periods, d) =>
      periods.forEach((slot, p) => {
        if (!slot?.teacherId) return;
        if (!m.has(slot.teacherId)) m.set(slot.teacherId, WEEKDAYS.map(() => TEACHING_PERIODS.map(() => null)));
        m.get(slot.teacherId)![d][p] = classKey;
      }),
    );
  }
  return (_busy = m);
}

export function lessonsPerWeek(teacherId: string) {
  const g = busyIndex().get(teacherId);
  return g ? g.flat().filter(Boolean).length : 0;
}

/** Staff who can be timetabled (have at least one lesson). */
export function timetabledStaff() {
  const idx = busyIndex();
  return staff().filter((s) => idx.has(s.id));
}

/**
 * Best free teacher for a period: free that period, not on leave, prefers the
 * same subject, then the same stage, then the lightest day.
 */
export function suggestSubstitute({
  day,
  period,
  subject,
  stage,
  exclude,
}: {
  day: number;
  period: number;
  subject: string;
  stage: Staff["teaches"][number];
  exclude: Set<string>;
}): Staff | null {
  const idx = busyIndex();
  let best: { s: Staff; score: number } | null = null;
  for (const [id, grid] of idx) {
    if (exclude.has(id) || grid[day][period]) continue;
    const s = staffById(id);
    if (!s || (s.category !== "Teaching" && s.category !== "Co-curricular")) continue;
    const dayLoad = grid[day].filter(Boolean).length;
    if (dayLoad >= 6) continue;
    const score = (s.subjects.includes(subject) ? 6 : 0) + (s.teaches.includes(stage) ? 3 : 0) + (s.category === "Teaching" ? 1 : 0) - dayLoad * 0.6;
    if (!best || score > best.score) best = { s, score };
  }
  return best?.s ?? null;
}

// ——— Week grid ——————————————————————————————————————————————————————

export type CellSpec = {
  tint?: Tint;
  title: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  variant?: "lesson" | "free" | "cover" | "alert";
} | null;

function Cell({ c, now, compact }: { c: CellSpec; now?: boolean; compact?: boolean }) {
  if (!c) return <div className={cn("rounded-lg", compact ? "h-full min-h-[52px]" : "h-[60px]")} />;
  const v = c.variant ?? "lesson";
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col justify-center rounded-lg px-2.5 py-1.5",
        compact ? "h-full min-h-[52px]" : "h-[62px]",
        v === "lesson" && "border-l-[3px]",
        v === "free" && "border border-dashed border-line-strong bg-transparent",
        v === "cover" && "border border-dashed border-warn/60 bg-warn-soft",
        v === "alert" && "border border-dashed border-bad/50 bg-bad-soft/70",
        now && "ring-2 ring-brand ring-offset-1 ring-offset-surface",
      )}
      style={v === "lesson" && c.tint ? { background: c.tint.bg, borderLeftColor: c.tint.edge } : undefined}
    >
      <p className={cn("truncate text-[12.5px] leading-tight font-semibold", v === "free" ? "font-normal text-faint" : "text-ink")}>{c.title}</p>
      {c.sub && <p className="mt-0.5 truncate text-[11.5px] leading-tight text-ink-2/80">{c.sub}</p>}
      {c.meta && <p className="truncate text-[11px] leading-tight text-muted">{c.meta}</p>}
    </div>
  );
}

/** Mon–Fri × periods (with Break and Lunch rows) on desktop; a day-by-day list on phones. */
export function WeekGrid({ cells, today, current, ariaLabel }: { cells: CellSpec[][]; today: number | null; current: number | null; ariaLabel: string }) {
  const [day, setDay] = useState(today ?? 0);
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full table-fixed border-separate border-spacing-[3px]" aria-label={ariaLabel}>
          <thead>
            <tr>
              <th className="w-[76px]" />
              {WEEKDAYS.map((d, i) => (
                <th key={d} scope="col" className="pb-1.5 text-left">
                  <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[12px] font-semibold", today === i ? "bg-brand text-white" : "text-ink-2")}>
                    {d}
                    {today === i && <span className="text-[10.5px] font-medium text-white/75">Today</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p, rowIdx) => {
              if (p.n === 0)
                return (
                  <tr key={`b${rowIdx}`}>
                    <td colSpan={6} className="h-7 rounded-md bg-ink/[0.035] text-center text-[11.5px] font-medium text-muted">
                      {"label" in p ? p.label : ""} · {fmtClock(p.start)} – {fmtClock(p.end)}
                    </td>
                  </tr>
                );
              const pi = p.n - 1;
              const isNow = current === pi;
              return (
                <tr key={p.n}>
                  <th scope="row" className="pr-1 text-left align-middle font-normal">
                    <span className={cn("block text-[12px] font-semibold", isNow ? "text-brand" : "text-ink-2")}>
                      {isNow ? "Now · " : ""}P{p.n}
                    </span>
                    <span className="tnum block text-[11px] whitespace-nowrap text-muted">
                      {fmtClock(p.start).replace(/ (am|pm)$/, "")}–{fmtClock(p.end).replace(/ (am|pm)$/, "")}
                    </span>
                  </th>
                  {WEEKDAYS.map((_, d) => (
                    <td key={d} className={cn("p-0 align-top", today === d && "bg-brand-soft/45")}>
                      <Cell c={cells[d][pi]} now={isNow && today === d} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        <Segmented
          label="Day"
          value={String(day)}
          onChange={(v) => setDay(Number(v))}
          className="mb-3 flex w-full [&>button]:flex-1 [&>button]:justify-center"
          options={WEEKDAYS.map((d, i) => ({
            value: String(i),
            label: (
              <>
                {d}
                {today === i && <span className="size-1.5 rounded-full bg-brand" aria-label="today" />}
              </>
            ),
          }))}
        />
        <ol className="flex flex-col gap-1.5">
          {PERIODS.map((p, rowIdx) => {
            if (p.n === 0)
              return (
                <li key={`b${rowIdx}`} className="rounded-md bg-ink/[0.035] py-1 text-center text-[11.5px] text-muted">
                  {"label" in p ? p.label : ""} · {fmtClock(p.start)}
                </li>
              );
            const pi = p.n - 1;
            const isNow = current === pi && today === day;
            return (
              <li key={p.n} className="grid grid-cols-[52px_minmax(0,1fr)] items-stretch gap-2">
                <div className="flex flex-col justify-center">
                  <span className={cn("text-[12px] font-semibold", isNow ? "text-brand" : "text-ink-2")}>P{p.n}</span>
                  <span className="tnum text-[11px] text-muted">{fmtClock(p.start).replace(/ (am|pm)$/, "")}</span>
                </div>
                <Cell c={cells[day][pi] ?? { title: "—", variant: "free" }} now={isNow} compact />
              </li>
            );
          })}
        </ol>
      </div>
    </>
  );
}
