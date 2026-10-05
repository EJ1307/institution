// Attendance: each student's status on any school day is a pure function of
// (student, date), shaped by realistic effects — Mondays, monsoon, the day after
// a holiday — and overlaid with whatever has been marked in the demo store.

import { hash01 } from "@/lib/rng";
import { getState, setState, type AttendanceMark } from "@/lib/store";
import { addDays, isoDate, isSchoolDay, lastSchoolDay, schoolDaysBack, today } from "./calendar";
import { CLASSES, GRADE_BY_ID } from "./school";
import { staff, students, studentsInClass, type Staff, type Student } from "./people";

export type Mark = AttendanceMark;

/** Classes whose register for the current school day starts unmarked (the teacher marks it in the demo). */
export const UNMARKED_TODAY = new Set(["8-B"]);

/** The school day the demo treats as "today" (falls back to the last school day on weekends/holidays). */
export function currentSchoolDay(): Date {
  return lastSchoolDay(today());
}

// dayFactor is a pure function of the date and sits on the hot path (every
// student × every day in a trend), so it is memoised per calendar day.
const factorCache = new Map<number, number>();
function dayFactor(d: Date): number {
  const k = d.getTime();
  let f = factorCache.get(k);
  if (f === undefined) factorCache.set(k, (f = computeDayFactor(d)));
  return f;
}

function computeDayFactor(d: Date): number {
  let f = 1;
  const w = d.getDay();
  if (w === 1) f -= 0.012;
  if (w === 5) f -= 0.018;
  const m = d.getMonth();
  if (m === 6 || m === 7) f -= 0.02; // monsoon
  if (m === 10 || m === 11) f -= 0.012; // smog season / winter colds
  if (!isSchoolDay(addDays(d, -1)) && !isSchoolDay(addDays(d, -3))) f -= 0.02; // after a long weekend
  // a mild "flu week" every so often
  f -= 0.025 * Math.max(0, Math.sin((d.getTime() / 86400000) / 9.3) - 0.6);
  return f;
}

export function generatedMark(s: Student, d: Date): Mark {
  const p = s.attendanceBase * dayFactor(d);
  const x = hash01(s.id, isoDate(d));
  if (x < p) {
    // a small share of present students arrive late
    return hash01("late", s.id, isoDate(d)) < 0.035 ? "L" : "P";
  }
  // of the absences, ~25% are pre-approved leave
  return hash01("leave", s.id, isoDate(d)) < 0.25 ? "E" : "A";
}

function registerKey(classKey: string, d: Date) {
  return `${classKey}|${isoDate(d)}`;
}

/** Is the register for this class/date marked (generated history counts as marked)? */
export function isMarked(classKey: string, d: Date): boolean {
  if (!UNMARKED_TODAY.has(classKey)) return true;
  const iso = isoDate(d);
  if (iso === isoDate(currentSchoolDay())) {
    return Boolean(getState().attendance[registerKey(classKey, d)]);
  }
  return true;
}

export function markFor(s: Student, d: Date): Mark | null {
  if (!isSchoolDay(d)) return null;
  const override = getState().attendance[registerKey(s.classKey, d)]?.[s.id];
  if (override) return override;
  if (!isMarked(s.classKey, d)) return null;
  return generatedMark(s, d);
}

export function saveRegister(classKey: string, d: Date, marks: Record<string, Mark>) {
  const key = registerKey(classKey, d);
  setState((st) => ({ attendance: { ...st.attendance, [key]: marks } }));
}

export type DayCount = { present: number; late: number; absent: number; leave: number; total: number; unmarked: number; rate: number };

function emptyCount(): DayCount {
  return { present: 0, late: 0, absent: 0, leave: 0, total: 0, unmarked: 0, rate: 0 };
}

function finish(c: DayCount): DayCount {
  const marked = c.total - c.unmarked;
  c.rate = marked ? (c.present + c.late) / marked : 0;
  return c;
}

function tally(list: Student[], d: Date): DayCount {
  const c = emptyCount();
  for (const s of list) {
    c.total++;
    const m = markFor(s, d);
    if (m === null) c.unmarked++;
    else if (m === "P") c.present++;
    else if (m === "L") c.late++;
    else if (m === "A") c.absent++;
    else c.leave++;
  }
  return finish(c);
}

export function classDay(classKey: string, d: Date): DayCount {
  return tally(studentsInClass(classKey), d);
}

export function schoolDayCount(d: Date): DayCount {
  return tally(students(), d);
}

/** School-wide attendance rate for the last `n` school days, oldest first. */
export function schoolTrend(n: number, end: Date = currentSchoolDay()) {
  return schoolDaysBack(n, end).map((d) => ({ date: d, ...schoolDayCount(d) }));
}

/** Per class rates for a day — used by the heatmap. */
export function classGrid(d: Date) {
  return CLASSES.map((c) => ({ ...c, label: `${GRADE_BY_ID[c.grade].short}-${c.section}`, ...classDay(c.key, d) }));
}

export function studentSummary(s: Student, days: Date[]) {
  const c = emptyCount();
  for (const d of days) {
    const m = markFor(s, d);
    c.total++;
    if (m === null) c.unmarked++;
    else if (m === "P") c.present++;
    else if (m === "L") c.late++;
    else if (m === "A") c.absent++;
    else c.leave++;
  }
  return finish(c);
}

/** Students whose attendance over the window is under `threshold`. */
export function lowAttendance(days: Date[], threshold = 0.85, list: Student[] = students()) {
  return list
    .map((s) => ({ student: s, ...studentSummary(s, days) }))
    .filter((x) => x.rate < threshold)
    .sort((a, b) => a.rate - b.rate);
}

// ——— Staff attendance & leave —————————————————————————————————————

export type LeaveType = "Casual" | "Sick" | "Earned" | "On duty";

export type LeaveRequest = {
  id: string;
  staff: Staff;
  type: LeaveType;
  from: Date;
  to: Date;
  days: number;
  reason: string;
  appliedOn: Date;
  status: "pending" | "approved" | "declined";
  substitute: string | null;
};

const REASONS: Record<LeaveType, string[]> = {
  Casual: ["Family function in Jaipur", "Child's school PTM", "Personal work — bank & property registration", "Sister's wedding"],
  Sick: ["Viral fever", "Dental procedure", "Migraine — doctor's advice to rest", "Back strain"],
  Earned: ["Family trip planned during long weekend", "Visiting parents in Kochi"],
  "On duty": ["CBSE evaluator training", "Inter-school debate — accompanying team", "Workshop on competency-based assessment"],
};

/** Leave requests around the current school day: some approved (on leave today), some pending. */
export function leaveRequests(): LeaveRequest[] {
  const d0 = currentSchoolDay();
  const pool = staff().filter((s) => s.category !== "Leadership");
  const out: LeaveRequest[] = [];
  const types: LeaveType[] = ["Casual", "Sick", "Earned", "On duty"];
  for (let i = 0; i < 11; i++) {
    const s = pool[Math.floor(hash01("leave-staff", i, isoDate(d0).slice(0, 7)) * pool.length)];
    if (out.some((o) => o.staff.id === s.id)) continue;
    const type = types[Math.floor(hash01("leave-type", i) * types.length)];
    const offset = i < 5 ? -Math.floor(hash01("lo", i) * 2) : 1 + Math.floor(hash01("lo", i) * 9);
    const from = addDays(d0, offset);
    const days = type === "Earned" ? 3 : type === "Sick" ? 1 + Math.floor(hash01("ld", i) * 2) : 1;
    const to = addDays(from, days - 1);
    const reasons = REASONS[type];
    const decided = getState().leaveDecisions[`L${i}`];
    const status: LeaveRequest["status"] = decided ?? (i < 5 ? "approved" : i < 7 && hash01("ls", i) < 0.5 ? "approved" : "pending");
    const sub = pool[Math.floor(hash01("sub", i) * pool.length)];
    out.push({
      id: `L${i}`,
      staff: s,
      type,
      from,
      to,
      days,
      reason: reasons[Math.floor(hash01("lr", i) * reasons.length)],
      appliedOn: addDays(from, -(1 + Math.floor(hash01("la", i) * 6))),
      status,
      substitute: status === "approved" && s.category === "Teaching" ? (getState().leaveSubstitutes?.[`L${i}`] ?? `${sub.title} ${sub.name}`) : null,
    });
  }
  return out;
}

export function staffOnLeave(d: Date = currentSchoolDay()) {
  const iso = isoDate(d);
  return leaveRequests().filter((l) => l.status === "approved" && isoDate(l.from) <= iso && isoDate(l.to) >= iso);
}

export function staffPresence(d: Date = currentSchoolDay()) {
  const total = staff().length;
  const onLeave = staffOnLeave(d).length;
  const late = Math.floor(hash01("staff-late", isoDate(d)) * 4);
  return { total, onLeave, present: total - onLeave, late };
}
