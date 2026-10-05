// Homework: what a teacher has set, who has handed it in, and what a parent's
// child still has to do. Submission status is derived deterministically from
// the student, the assignment and today's date.

import { addDays, schoolDaysBack, today } from "@/lib/data/calendar";
import { homeworkFor, type Homework } from "@/lib/data/communication";
import { staffById, staffDisplayName, studentsInClass, type Student } from "@/lib/data/people";
import { GRADE_BY_ID, SUBJECTS, classLabel, type GradeId } from "@/lib/data/school";
import { classTimetable, teacherTimetable } from "@/lib/data/timetable";
import { clamp, hash01 } from "@/lib/rng";
import { fmtTime, fmtWeekday } from "@/lib/format";

export const CLASS_TEACHER_OF = "8-B";

export type HwItem = Homework & {
  /** display name of whoever set it */
  by: string;
  mine: boolean;
  /** set in the demo */
  posted: boolean;
};

export type SubStatus = "submitted" | "late" | "pending";

const DAY = 86400000;

export function keyParts(classKey: string) {
  const [g, s] = classKey.split("-");
  return { grade: g as GradeId, section: s, label: classLabel(g as GradeId, s) };
}

/** The teacher's sections, own class first. */
export function teacherClasses(teacherId: string): string[] {
  const keys = new Set<string>();
  teacherTimetable(teacherId).flat().forEach((s) => s && keys.add(s.classKey));
  const ord = (k: string) => GRADE_BY_ID[k.split("-")[0] as GradeId].order;
  return [...keys].sort((a, b) => Number(b === CLASS_TEACHER_OF) - Number(a === CLASS_TEACHER_OF) || ord(a) - ord(b) || a.localeCompare(b));
}

/** Who teaches a subject to a class, from the timetable. */
export function teacherFor(classKey: string, subjectName: string): string | null {
  const tt = classTimetable(classKey);
  const sub = Object.values(SUBJECTS).find((s) => s.name === subjectName)?.id;
  if (!tt || !sub) return null;
  for (const day of tt) for (const slot of day) if (slot?.subject === sub && slot.teacherId) {
    const st = staffById(slot.teacherId);
    return st ? staffDisplayName(st) : null;
  }
  return null;
}

// Maths homework Ms. Iyer has set over the last fortnight, by class (NCERT chapters for the term).
const MATHS: Record<string, [string, string][]> = {
  "8-B": [
    ["Comparing Quantities: Exercise 7.2, Q1–8", "Percentages, profit and loss, and discount. Write the formula you use before each answer."],
    ["Worksheet: compound interest", "Questions 1–10 on the printed sheet. Use the formula, not repeated simple interest."],
    ["Algebraic identities: Exercise 8.4", "Use (a + b)² and (a − b)² to expand. Q6–8 are optional challenge questions."],
    ["Mensuration: the area of a trapezium", "Measure the top of your study table and find its area in cm². Show all working."],
  ],
  "7-C": [
    ["Simple Equations: Exercise 4.2", "Solve Q1–10. Check every answer by putting it back into the equation."],
    ["Lines and Angles worksheet", "Name each pair of angles in the figures: linear pair, vertically opposite, or alternate."],
    ["Equations from stories", "Turn each of the six short stories into an equation, then solve it."],
  ],
  "6-B": [
    ["Fractions: Exercise 7.4", "Add and subtract unlike fractions. Draw a fraction strip for Q3."],
    ["Perimeter at home", "Measure five things at home (a book, a door, a tile…) and find each perimeter in cm."],
    ["Decimals practice set", "Twenty short questions converting between fractions and decimals."],
  ],
  "10-B": [
    ["Introduction to Trigonometry: Exercise 8.1", "Q1–11. Draw the right triangle for every question before writing the ratio."],
    ["Trigonometric identities: proofs", "Exercise 8.4, Q5 (i)–(x). State the identity you use at each step."],
    ["CBSE sample paper, Section A", "Attempt in 40 minutes without a calculator. Circle any question you guessed."],
    ["Heights and distances: five problems", "From the worksheet shared on the portal. Neat, labelled diagrams carry marks."],
  ],
};

function curated(classKey: string, idx: number, teacherName: string): HwItem[] {
  const days = schoolDaysBack(14, today());
  return (MATHS[classKey] ?? []).map(([title, detail], j) => {
    const assignedOn = days[Math.max(0, days.length - 1 - (j * 3 + idx))];
    let dueOn = addDays(assignedOn, 1 + ((j + idx) % 3));
    while (dueOn.getDay() === 0 || dueOn.getDay() === 6) dueOn = addDays(dueOn, 1);
    return { id: `HWT-${classKey}-${j}`, classKey, subject: "Mathematics", title, detail, assignedOn, dueOn, by: teacherName, mine: true, posted: false };
  });
}

/** Everything a teacher should see: their own subject in every section, plus all subjects for their own class. */
export function teacherHomework(teacherId: string, teacherName: string): HwItem[] {
  const classes = teacherClasses(teacherId);
  const out: HwItem[] = [];
  classes.forEach((k, idx) => {
    const { grade, section } = keyParts(k);
    out.push(...curated(k, idx, teacherName));
    for (const h of homeworkFor(k, grade, section)) {
      const posted = Boolean(h.setBy);
      const mine = h.subject === "Mathematics";
      if (!mine && k !== CLASS_TEACHER_OF) continue;
      out.push({ ...h, by: h.setBy ?? (mine ? teacherName : teacherFor(k, h.subject) ?? "Subject teacher"), mine: mine || h.setBy === teacherName, posted });
    }
  });
  return sortHomework(out);
}

export function childHomework(child: Student): HwItem[] {
  return sortHomework(
    homeworkFor(child.classKey, child.grade, child.section).map((h) => ({ ...h, by: h.setBy ?? teacherFor(child.classKey, h.subject) ?? "Class teacher", mine: false, posted: Boolean(h.setBy) })),
  );
}

/** The generator sometimes repeats a task for the same class; keep only the latest copy. */
function dedupe(list: HwItem[]) {
  const latest = new Map<string, HwItem>();
  for (const h of list) {
    const k = `${h.classKey}|${h.subject}|${h.title}`;
    const prev = latest.get(k);
    if (!prev || h.assignedOn > prev.assignedOn || h.posted) latest.set(k, h);
  }
  return list.filter((h) => latest.get(`${h.classKey}|${h.subject}|${h.title}`) === h);
}

function sortHomework(list: HwItem[]) {
  return dedupe(list).sort((a, b) => Number(b.posted) - Number(a.posted) || b.assignedOn.getTime() - a.assignedOn.getTime() || a.classKey.localeCompare(b.classKey));
}

// ——— Submissions ——————————————————————————————————————————————————

export function daysUntil(d: Date, t = today()) {
  return Math.round((d.getTime() - t.getTime()) / DAY);
}

export function statusFor(h: HwItem | Homework, s: Student, t = today()): { status: SubStatus; at: Date | null } {
  if ((h as HwItem).posted) return { status: "pending", at: null };
  const r = hash01("sub", h.id, s.id);
  const p = clamp(0.87 + 0.06 * s.ability + (s.attendanceBase - 0.94) * 1.5, 0.6, 0.985);
  const left = daysUntil(h.dueOn, t);
  const mins = (k: string) => Math.floor(hash01(k, h.id, s.id) * 60);
  /** the evening before (uploaded from home) or the due morning (handed in at school) */
  const handIn = (due: Date, k: string) => {
    const inClass = hash01("ic", h.id, s.id) < 0.45 && due.getTime() <= t.getTime();
    const d = inClass ? new Date(due) : addDays(due, -1);
    d.setHours(inClass ? 7 + (hash01(k, h.id, s.id) < 0.6 ? 1 : 0) : 17 + Math.floor(hash01("h", h.id, s.id) * 5), inClass ? 5 + Math.floor(hash01("m", h.id, s.id) * 40) : mins("m"));
    return d;
  };
  if (left < 0) {
    if (r < p) return { status: "submitted", at: handIn(h.dueOn, "a") };
    if (r < p + (1 - p) * 0.65) {
      const d = addDays(h.dueOn, 1 + Math.floor(hash01("l", h.id, s.id) * 2));
      d.setHours(8, 5 + mins("lm") % 35);
      return { status: "late", at: d };
    }
    return { status: "pending", at: null };
  }
  const sinceSet = daysUntil(t, h.assignedOn);
  const early = sinceSet <= 0 ? 0 : left === 0 ? p * 0.82 : left === 1 ? p * 0.35 : p * 0.12;
  if (r < early) {
    if (left === 0) return { status: "submitted", at: handIn(h.dueOn, "b") };
    // handed in early: an evening between the day it was set and yesterday
    const d = addDays(t, -1 - Math.floor(hash01("e", h.id, s.id) * Math.max(0, Math.min(2, sinceSet - 1))));
    d.setHours(17 + Math.floor(hash01("h", h.id, s.id) * 5), mins("m"));
    return { status: "submitted", at: d };
  }
  return { status: "pending", at: null };
}

export type Tally = { total: number; submitted: number; late: number; pending: number };

export function tally(h: HwItem, kids: Student[] = studentsInClass(h.classKey)): Tally {
  const t: Tally = { total: kids.length, submitted: 0, late: 0, pending: 0 };
  for (const s of kids) t[statusFor(h, s).status]++;
  return t;
}

export function handedInLabel(at: Date | null) {
  return at ? `${fmtWeekday(at)}, ${fmtTime(at)}` : "";
}

/** "Due today", "Due tomorrow", "Due Thursday", "Was due Thu, 1 Oct". */
export function dueLabel(due: Date, t = today()) {
  const d = daysUntil(due, t);
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d > 1 && d < 7) return `Due ${due.toLocaleDateString("en-IN", { weekday: "long" })}`;
  if (d >= 7) return `Due ${fmtWeekday(due)}`;
  if (d === -1) return "Was due yesterday";
  return `Was due ${fmtWeekday(due)}`;
}
