// Staff-page helpers: today's presence, timetables, leave balances and
// substitute suggestions — all derived from the shared data layer.

import { hash01 } from "@/lib/rng";
import { leaveRequests, staffOnLeave, staffPresence, type LeaveRequest } from "@/lib/data/attendance";
import { isoDate, schoolDaysBetween } from "@/lib/data/calendar";
import { staff, type Staff } from "@/lib/data/people";
import { classLabel, GRADE_BY_ID, type GradeId } from "@/lib/data/school";
import { teacherTimetable, type TeacherSlot } from "@/lib/data/timetable";

export type Presence = { status: "present" | "late" | "leave"; time: string | null; leave: LeaveRequest | null };

function clock(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/** Everyone's status on a school day: biometric check-in time, late, or on approved leave. */
export function presenceOn(day: Date): Map<string, Presence> {
  const iso = isoDate(day);
  const leave = new Map(staffOnLeave(day).map((l) => [l.staff.id, l]));
  const lateCount = staffPresence(day).late;
  const others = staff().filter((s) => !leave.has(s.id));
  const late = new Set(
    [...others]
      .filter((s) => s.category !== "Leadership")
      .sort((a, b) => hash01("late-pick", a.id, iso) - hash01("late-pick", b.id, iso))
      .slice(0, lateCount)
      .map((s) => s.id),
  );
  const out = new Map<string, Presence>();
  for (const s of staff()) {
    const l = leave.get(s.id);
    if (l) out.set(s.id, { status: "leave", time: null, leave: l });
    else if (late.has(s.id)) out.set(s.id, { status: "late", time: clock(8 * 60 + 4 + Math.floor(hash01("late-t", s.id, iso) * 22)), leave: null });
    else out.set(s.id, { status: "present", time: clock(7 * 60 + 12 + Math.floor(hash01("in-t", s.id, iso) * 34)), leave: null });
  }
  return out;
}

// ——— Timetables ————————————————————————————————————————————————————

const ttCache = new Map<string, (TeacherSlot | null)[][]>();
export function weekOf(id: string) {
  let t = ttCache.get(id);
  if (!t) ttCache.set(id, (t = teacherTimetable(id)));
  return t;
}

export function weeklyLoad(id: string) {
  return weekOf(id).reduce((a, d) => a + d.filter(Boolean).length, 0);
}

export function classesTaught(id: string): string[] {
  const keys = new Set<string>();
  weekOf(id).forEach((d) => d.forEach((s) => s && keys.add(s.classKey)));
  const order = (k: string) => GRADE_BY_ID[k.split("-")[0] as GradeId].order;
  return [...keys].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
}

export function shortClass(key: string) {
  const [g, sec] = key.split("-");
  return classLabel(g as GradeId, sec);
}

// ——— Leave balance ————————————————————————————————————————————————————

export const LEAVE_ENTITLEMENT = { Casual: 12, Sick: 10, Earned: 10 } as const;

export function leaveBalance(s: Staff) {
  const reqs = leaveRequests().filter((l) => l.staff.id === s.id && l.status === "approved");
  const extra = (t: string) => reqs.filter((l) => l.type === t).reduce((a, l) => a + l.days, 0);
  return (Object.keys(LEAVE_ENTITLEMENT) as (keyof typeof LEAVE_ENTITLEMENT)[]).map((type) => {
    const base = Math.floor(hash01("leave-used", s.id, type) * (type === "Casual" ? 6 : type === "Sick" ? 4 : 3));
    const used = Math.min(LEAVE_ENTITLEMENT[type], base + extra(type));
    return { type, total: LEAVE_ENTITLEMENT[type], used };
  });
}

// ——— Cover for teaching staff on leave ———————————————————————————————————

export type CoverSlot = { date: Date; day: number; period: number; slot: TeacherSlot };
export type CoverOption = { staff: Staff; free: number; reason: string };

export function coverPlan(l: LeaveRequest): { slots: CoverSlot[]; options: CoverOption[] } | null {
  if (l.staff.category !== "Teaching") return null;
  const days = schoolDaysBetween(l.from, l.to);
  const mine = weekOf(l.staff.id);
  const slots: CoverSlot[] = [];
  for (const d of days) {
    const wd = (d.getDay() + 6) % 7;
    if (wd > 4) continue;
    mine[wd].forEach((slot, p) => slot && slots.push({ date: d, day: wd, period: p, slot }));
  }
  // teachers already away on any of these days can't cover
  const away = new Set(
    leaveRequests()
      .filter((x) => x.status === "approved" && x.id !== l.id && isoDate(x.from) <= isoDate(l.to) && isoDate(x.to) >= isoDate(l.from))
      .map((x) => x.staff.id),
  );
  const subj = new Set(l.staff.subjects);
  const options = staff()
    .filter((c) => c.category === "Teaching" && c.id !== l.staff.id && !away.has(c.id) && c.teaches.some((t) => l.staff.teaches.includes(t)))
    .map((c) => {
      const week = weekOf(c.id);
      const free = slots.filter((x) => !week[x.day][x.period]).length;
      const sameSubject = c.subjects.some((x) => subj.has(x));
      const sameDept = c.department === l.staff.department;
      const load = weeklyLoad(c.id);
      const score = free * 10 + (sameSubject ? 8 : sameDept ? 4 : 0) - load * 0.15;
      const reason = sameSubject ? c.designation : sameDept ? `${c.department} department` : `${c.designation}, ${load} periods a week`;
      return { staff: c, free, reason, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ staff: s, free, reason }) => ({ staff: s, free, reason }));
  return { slots, options };
}

