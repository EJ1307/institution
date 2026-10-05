// Weekly timetables for Classes I–XII, built greedily so no teacher is ever
// double-booked. Pre-primary runs a simpler activity schedule.

import { Rng } from "@/lib/rng";
import { CLASSES, GRADE_BY_ID, SUBJECTS, TEACHING_PERIODS, WEEKDAYS, weeklyPlan } from "./school";
import { staff, type Staff } from "./people";

export type Slot = { subject: string; teacherId: string | null; room: string };
/** timetable[classKey][day 0..4][period 0..7] */
export type Timetable = Record<string, (Slot | null)[][]>;

function stageOf(grade: string): Staff["teaches"][number] {
  const st = GRADE_BY_ID[grade as keyof typeof GRADE_BY_ID].stage;
  if (st === "Pre-primary") return "pre";
  if (st === "Primary") return "primary";
  if (st === "Senior secondary") return "senior";
  return "middle";
}

function build(): Timetable {
  const r = new Rng("amaltas-timetable-v1");
  const all = staff();
  const busy = new Map<string, Set<string>>(); // teacherId → "d-p"
  const dayLoad = new Map<string, number>(); // teacherId|day → lessons
  const MAX_PER_DAY = 6;
  const isFree = (t: string, d: number, p: number) => !busy.get(t)?.has(`${d}-${p}`) && (dayLoad.get(`${t}|${d}`) ?? 0) < MAX_PER_DAY;
  const book = (t: string, d: number, p: number) => {
    if (!busy.has(t)) busy.set(t, new Set());
    busy.get(t)!.add(`${d}-${p}`);
    dayLoad.set(`${t}|${d}`, (dayLoad.get(`${t}|${d}`) ?? 0) + 1);
  };
  const load = new Map<string, number>();

  // assign one teacher per (class, subject), balancing load
  const assignment = new Map<string, string>(); // classKey|subject → teacherId
  const teachable = CLASSES.filter((c) => GRADE_BY_ID[c.grade].stage !== "Pre-primary");
  for (const c of teachable) {
    const stage = stageOf(c.grade);
    const plan = weeklyPlan(c.grade, c.section);
    for (const [sub, periods] of Object.entries(plan)) {
      let candidates = all.filter((s) => s.subjects.includes(sub) && s.teaches.includes(stage));
      // primary class teachers take their own class's core subjects
      if (stage === "primary" && ["eng", "mat", "evs"].includes(sub)) {
        candidates = all.filter((s) => s.classTeacherOf === c.key);
      }
      if (!candidates.length) candidates = all.filter((s) => s.subjects.includes(sub));
      if (!candidates.length) continue;
      // class teachers of VI–XII teach their own class when they can
      const own = candidates.find((s) => s.classTeacherOf === c.key);
      const pick = own ?? candidates.reduce((a, b) => ((load.get(a.id) ?? 0) <= (load.get(b.id) ?? 0) ? a : b));
      assignment.set(`${c.key}|${sub}`, pick.id);
      load.set(pick.id, (load.get(pick.id) ?? 0) + periods);
    }
  }

  // Fill period by period across all classes at once so clashes spread evenly.
  const tt: Timetable = {};
  const remaining: Record<string, Record<string, number>> = {};
  for (const c of teachable) {
    tt[c.key] = WEEKDAYS.map(() => TEACHING_PERIODS.map(() => null));
    remaining[c.key] = { ...weeklyPlan(c.grade, c.section) };
  }
  for (let d = 0; d < WEEKDAYS.length; d++) {
    const usedToday = new Map<string, number>(); // classKey|subject → count
    for (let p = 0; p < TEACHING_PERIODS.length; p++) {
      for (const c of r.shuffle([...teachable])) {
        const rem = remaining[c.key];
        const daysLeft = WEEKDAYS.length - d;
        const options = Object.keys(rem)
          .filter((s) => rem[s] > 0)
          .filter((s) => (usedToday.get(`${c.key}|${s}`) ?? 0) < (rem[s] > daysLeft ? 2 : 1))
          .filter((s) => {
            const t = assignment.get(`${c.key}|${s}`);
            return !t || isFree(t, d, p);
          });
        const room = `${GRADE_BY_ID[c.grade].short}-${c.section}`;
        if (!options.length) {
          tt[c.key][d][p] = { subject: p % 2 ? "lib" : "pe", teacherId: null, room: p % 2 ? "Library" : "Sports field" };
          continue;
        }
        options.sort((a, b) => rem[b] - rem[a] + (r.next() - 0.5) * 2);
        const sub = options[0];
        const teacher = assignment.get(`${c.key}|${sub}`) ?? null;
        if (teacher) book(teacher, d, p);
        rem[sub]--;
        usedToday.set(`${c.key}|${sub}`, (usedToday.get(`${c.key}|${sub}`) ?? 0) + 1);
        const place = sub === "pe" ? "Sports field" : sub === "lib" ? "Library" : sub === "cs" ? "Computer lab" : sub === "mus" ? "Music room" : sub === "art" ? "Art studio" : ["phy", "che", "bio"].includes(sub) && p % 3 === 2 ? "Science lab" : room;
        tt[c.key][d][p] = { subject: sub, teacherId: teacher, room: place };
      }
    }
  }
  return tt;
}

let _tt: Timetable | null = null;
export function timetable(): Timetable {
  return (_tt ??= build());
}

export function classTimetable(classKey: string) {
  return timetable()[classKey] ?? null;
}

export type TeacherSlot = Slot & { classKey: string };

/** A teacher's week: [day][period] → their lesson or null. */
export function teacherTimetable(teacherId: string): (TeacherSlot | null)[][] {
  const grid: (TeacherSlot | null)[][] = WEEKDAYS.map(() => TEACHING_PERIODS.map(() => null));
  for (const [classKey, days] of Object.entries(timetable())) {
    days.forEach((periods, d) =>
      periods.forEach((slot, p) => {
        if (slot?.teacherId === teacherId) grid[d][p] = { ...slot, classKey };
      }),
    );
  }
  return grid;
}

export function subjectName(id: string) {
  return SUBJECTS[id]?.name ?? id;
}

/** Index of the current teaching period (0-based) or null outside school hours. */
export function currentPeriodIndex(now: Date): number | null {
  const mins = now.getHours() * 60 + now.getMinutes();
  const idx = TEACHING_PERIODS.findIndex((p) => {
    const [sh, sm] = p.start.split(":").map(Number);
    const [eh, em] = p.end.split(":").map(Number);
    return mins >= sh * 60 + sm && mins < eh * 60 + em;
  });
  return idx === -1 ? null : idx;
}
