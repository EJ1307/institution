// Exams, marks and CBSE-style grading.

import { clamp, hash01 } from "@/lib/rng";
import { academicYear, today } from "./calendar";
import { examSubjects, hasMarks, type Subject } from "./school";
import { students, studentsInClass, type Student } from "./people";

export type Exam = {
  id: string;
  name: string;
  short: string;
  max: number;
  start: Date;
  end: Date;
  resultsOn: Date;
  /** average lift/drop vs ability — later exams a little harder */
  difficulty: number;
};

export function examsForYear(startYear = academicYear().startYear): Exam[] {
  const y = startYear;
  return [
    { id: `PT1-${y}`, name: "Periodic Test 1", short: "PT 1", max: 40, start: new Date(y, 6, 20), end: new Date(y, 6, 25), resultsOn: new Date(y, 7, 4), difficulty: 0.02 },
    { id: `HY-${y}`, name: "Half-Yearly Examination", short: "Half-yearly", max: 100, start: new Date(y, 8, 14), end: new Date(y, 8, 26), resultsOn: new Date(y, 9, 1), difficulty: -0.02 },
    { id: `PT2-${y}`, name: "Periodic Test 2", short: "PT 2", max: 40, start: new Date(y, 10, 23), end: new Date(y, 10, 28), resultsOn: new Date(y, 11, 8), difficulty: 0.0 },
    { id: `AN-${y}`, name: "Annual Examination", short: "Annual", max: 100, start: new Date(y + 1, 1, 22), end: new Date(y + 1, 2, 10), resultsOn: new Date(y + 1, 2, 28), difficulty: -0.01 },
  ];
}

/** Exams whose results are out, most recent last. Falls back to last year's annual exam early in the year. */
export function publishedExams(): Exam[] {
  const t = today();
  const ay = academicYear(t);
  const done = examsForYear(ay.startYear).filter((e) => e.resultsOn <= t);
  if (done.length) return done;
  return [examsForYear(ay.startYear - 1)[3]];
}

export function latestExam(): Exam {
  const p = publishedExams();
  return p[p.length - 1];
}

export function upcomingExam(): Exam | undefined {
  const t = today();
  return examsForYear(academicYear(t).startYear).find((e) => e.end >= t);
}

const SUBJECT_EASE: Record<string, number> = {
  eng: 0.04, hin: 0.03, mat: -0.06, evs: 0.05, sci: -0.02, sst: 0, skt: 0.05, fre: 0.04, cs: 0.05,
  phy: -0.07, che: -0.04, bio: 0, acc: -0.02, bst: 0.03, eco: -0.01, his: 0.02, pol: 0.03, psy: 0.05,
};

/** Marks out of exam.max for one student, one subject. */
export function mark(s: Student, exam: Exam, subjectId: string): number {
  const noise = (hash01(s.id, exam.id, subjectId) - 0.5) * 0.16;
  // subject affinity: each child is a little better at some subjects
  const affinity = (hash01("aff", s.id, subjectId) - 0.5) * 0.1;
  const frac = 0.735 + 0.115 * s.ability + (SUBJECT_EASE[subjectId] ?? 0) + exam.difficulty + noise + affinity;
  return Math.round(clamp(frac, 0.22, 1) * exam.max);
}

export const CBSE_GRADES = [
  { grade: "A1", min: 91 },
  { grade: "A2", min: 81 },
  { grade: "B1", min: 71 },
  { grade: "B2", min: 61 },
  { grade: "C1", min: 51 },
  { grade: "C2", min: 41 },
  { grade: "D", min: 33 },
  { grade: "E", min: 0 },
] as const;

export function gradeFor(pct: number): string {
  return CBSE_GRADES.find((g) => pct >= g.min)!.grade;
}

export type ReportRow = { subject: Subject; marks: number; max: number; pct: number; grade: string; classAvg: number; highest: number };

export type ReportCard = {
  student: Student;
  exam: Exam;
  rows: ReportRow[];
  total: number;
  max: number;
  pct: number;
  grade: string;
  rank: number;
  classSize: number;
};

const cache = new Map<string, ReturnType<typeof computeClassResults>>();

function computeClassResults(classKey: string, exam: Exam) {
  const list = studentsInClass(classKey);
  if (!list.length || !hasMarks(list[0].grade)) return null;
  const subjects = examSubjects(list[0].grade, list[0].section);
  const table = list.map((s) => {
    const marks = subjects.map((sub) => mark(s, exam, sub.id));
    const total = marks.reduce((a, b) => a + b, 0);
    return { student: s, marks, total, pct: (total / (subjects.length * exam.max)) * 100 };
  });
  const ranked = [...table].sort((a, b) => b.total - a.total);
  const rankOf = new Map(ranked.map((r, i) => [r.student.id, i + 1]));
  const subjectStats = subjects.map((sub, i) => {
    const vals = table.map((t) => t.marks[i]);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { subject: sub, avg, avgPct: (avg / exam.max) * 100, highest: Math.max(...vals), lowest: Math.min(...vals) };
  });
  const avgPct = table.reduce((a, t) => a + t.pct, 0) / table.length;
  const distribution = CBSE_GRADES.map((g) => ({ grade: g.grade, count: table.filter((t) => gradeFor(t.pct) === g.grade).length }));
  return { classKey, exam, subjects, table, ranked, rankOf, subjectStats, avgPct, distribution, passRate: table.filter((t) => t.pct >= 33).length / table.length };
}

export function classResults(classKey: string, exam: Exam = latestExam()) {
  const key = `${classKey}|${exam.id}`;
  if (!cache.has(key)) cache.set(key, computeClassResults(classKey, exam));
  return cache.get(key)!;
}

export function reportCard(s: Student, exam: Exam = latestExam()): ReportCard | null {
  const cr = classResults(s.classKey, exam);
  if (!cr) return null;
  const row = cr.table.find((t) => t.student.id === s.id)!;
  const rows: ReportRow[] = cr.subjects.map((sub, i) => ({
    subject: sub,
    marks: row.marks[i],
    max: exam.max,
    pct: (row.marks[i] / exam.max) * 100,
    grade: gradeFor((row.marks[i] / exam.max) * 100),
    classAvg: cr.subjectStats[i].avg,
    highest: cr.subjectStats[i].highest,
  }));
  return {
    student: s,
    exam,
    rows,
    total: row.total,
    max: cr.subjects.length * exam.max,
    pct: row.pct,
    grade: gradeFor(row.pct),
    rank: cr.rankOf.get(s.id)!,
    classSize: cr.table.length,
  };
}

/** School-wide toppers for an exam (Classes X and XII by default). */
export function toppers(grades: string[] = ["10", "12"], exam: Exam = latestExam(), n = 5) {
  return students()
    .filter((s) => grades.includes(s.grade))
    .map((s) => reportCard(s, exam)!)
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, n);
}
