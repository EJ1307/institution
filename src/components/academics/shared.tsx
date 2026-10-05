"use client";

import type { Tone } from "@/components/ui/primitives";
import { classResults, type Exam } from "@/lib/data/exams";
import { CLASSES, GRADE_BY_ID, hasMarks } from "@/lib/data/school";

/** CBSE grade → badge tone. Status colour only where it carries meaning. */
export function gradeTone(grade: string): Tone {
  if (grade === "A1" || grade === "A2") return "good";
  if (grade === "B1" || grade === "B2") return "neutral";
  if (grade === "C1" || grade === "C2") return "warn";
  return "bad";
}

export const RESULT_BINS = [
  { min: 75, label: "75%+", bg: "#D9ECE1", fg: "#1D5A40" },
  { min: 70, label: "70–75%", bg: "#F1F0EB", fg: "#3F4348" },
  { min: 65, label: "65–70%", bg: "#F8E6C2", fg: "#7A4D06" },
  { min: 0, label: "Below 65%", bg: "#F2C9BC", fg: "#7E2A17" },
];

export function resultTone(v: number) {
  return RESULT_BINS.find((b) => v >= b.min)!;
}

export const MARKED_CLASSES = CLASSES.filter((c) => hasMarks(c.grade));

export function examShortLabel(e: Exam, currentStartYear: number) {
  const y = e.start.getFullYear() - (e.start.getMonth() < 3 ? 1 : 0);
  return y === currentStartYear ? e.short : `${e.short} ’${String(y).slice(2)}`;
}

/** Average of every section in a grade for one subject (as % of max). */
export function gradeSubjectAvg(grade: string, subjectId: string, exam: Exam): number | null {
  const vals: number[] = [];
  for (const c of MARKED_CLASSES.filter((x) => x.grade === grade)) {
    const r = classResults(c.key, exam);
    const st = r?.subjectStats.find((s) => s.subject.id === subjectId);
    if (st) vals.push(st.avgPct);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Passing every subject: CBSE needs 33% in each. */
export function passedAll(marks: number[], max: number) {
  return marks.every((m) => m / max >= 0.33);
}

export function gradeLabel(grade: string) {
  return GRADE_BY_ID[grade as keyof typeof GRADE_BY_ID]?.label ?? grade;
}
