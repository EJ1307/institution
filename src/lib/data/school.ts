// Static description of the demo school: grades, sections, subjects, fees, bell timings.
// White-label: identity (name, motto, colours) lives in src/lib/brand.ts.

export type GradeId =
  | "N" | "LKG" | "UKG"
  | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12";

export type Stage = "Pre-primary" | "Primary" | "Middle" | "Secondary" | "Senior secondary";

export type Grade = {
  id: GradeId;
  label: string; // "Nursery", "Class VIII"
  short: string; // "Nur", "VIII"
  order: number;
  stage: Stage;
  sections: string[];
  size: number; // typical class strength
};

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function g(id: GradeId, order: number, stage: Stage, sections: string[], size: number): Grade {
  const n = Number(id);
  const isNum = !Number.isNaN(n);
  const label = isNum ? `Class ${ROMAN[n]}` : id === "N" ? "Nursery" : id;
  const short = isNum ? ROMAN[n] : id === "N" ? "Nur" : id;
  return { id, label, short, order, stage, sections, size };
}

export const GRADES: Grade[] = [
  g("N", 0, "Pre-primary", ["A", "B", "C"], 24),
  g("LKG", 1, "Pre-primary", ["A", "B", "C"], 26),
  g("UKG", 2, "Pre-primary", ["A", "B", "C"], 26),
  g("1", 3, "Primary", ["A", "B", "C", "D"], 30),
  g("2", 4, "Primary", ["A", "B", "C", "D"], 30),
  g("3", 5, "Primary", ["A", "B", "C", "D"], 31),
  g("4", 6, "Primary", ["A", "B", "C"], 34),
  g("5", 7, "Primary", ["A", "B", "C"], 34),
  g("6", 8, "Middle", ["A", "B", "C"], 35),
  g("7", 9, "Middle", ["A", "B", "C"], 35),
  g("8", 10, "Middle", ["A", "B", "C"], 35),
  g("9", 11, "Secondary", ["A", "B", "C"], 36),
  g("10", 12, "Secondary", ["A", "B", "C"], 36),
  g("11", 13, "Senior secondary", ["A", "B", "C", "D"], 28),
  g("12", 14, "Senior secondary", ["A", "B", "C", "D"], 27),
];

export const GRADE_BY_ID = Object.fromEntries(GRADES.map((x) => [x.id, x])) as Record<GradeId, Grade>;

/** Streams for senior secondary sections. */
export const STREAMS: Record<string, string> = {
  A: "Science · PCM",
  B: "Science · PCB",
  C: "Commerce",
  D: "Humanities",
};

export function classLabel(grade: GradeId, section: string) {
  return `${GRADE_BY_ID[grade].short}-${section}`;
}

export function classLabelLong(grade: GradeId, section: string) {
  const gr = GRADE_BY_ID[grade];
  const stream = gr.stage === "Senior secondary" ? ` (${STREAMS[section]})` : "";
  return `${gr.label} ${section}${stream}`;
}

export type ClassRef = { grade: GradeId; section: string; key: string };

export const CLASSES: ClassRef[] = GRADES.flatMap((gr) =>
  gr.sections.map((s) => ({ grade: gr.id, section: s, key: `${gr.id}-${s}` })),
);

export function hasMarks(grade: GradeId) {
  return GRADE_BY_ID[grade].stage !== "Pre-primary";
}

// ——— Subjects ———————————————————————————————————————————————

export type Subject = { id: string; name: string; short: string };

export const SUBJECTS: Record<string, Subject> = {
  eng: { id: "eng", name: "English", short: "Eng" },
  hin: { id: "hin", name: "Hindi", short: "Hin" },
  mat: { id: "mat", name: "Mathematics", short: "Math" },
  evs: { id: "evs", name: "EVS", short: "EVS" },
  sci: { id: "sci", name: "Science", short: "Sci" },
  sst: { id: "sst", name: "Social Science", short: "SSt" },
  skt: { id: "skt", name: "Sanskrit", short: "Skt" },
  fre: { id: "fre", name: "French", short: "Fre" },
  cs: { id: "cs", name: "Computer Science", short: "CS" },
  phy: { id: "phy", name: "Physics", short: "Phy" },
  che: { id: "che", name: "Chemistry", short: "Chem" },
  bio: { id: "bio", name: "Biology", short: "Bio" },
  acc: { id: "acc", name: "Accountancy", short: "Acc" },
  bst: { id: "bst", name: "Business Studies", short: "BSt" },
  eco: { id: "eco", name: "Economics", short: "Eco" },
  his: { id: "his", name: "History", short: "Hist" },
  pol: { id: "pol", name: "Political Science", short: "Pol" },
  psy: { id: "psy", name: "Psychology", short: "Psy" },
  pe: { id: "pe", name: "Physical Education", short: "PE" },
  art: { id: "art", name: "Art", short: "Art" },
  mus: { id: "mus", name: "Music", short: "Mus" },
  lib: { id: "lib", name: "Library", short: "Lib" },
  gk: { id: "gk", name: "General Knowledge", short: "GK" },
};

/** Examined subjects for a class (what shows up on report cards). */
export function examSubjects(grade: GradeId, section: string): Subject[] {
  const n = Number(grade);
  if (Number.isNaN(n)) return [];
  const ids =
    n <= 2 ? ["eng", "hin", "mat", "evs"]
    : n <= 5 ? ["eng", "hin", "mat", "evs", "cs"]
    : n <= 8 ? ["eng", "hin", "mat", "sci", "sst", section === "C" ? "fre" : "skt"]
    : n <= 10 ? ["eng", "hin", "mat", "sci", "sst"]
    : section === "A" ? ["eng", "phy", "che", "mat", "cs"]
    : section === "B" ? ["eng", "phy", "che", "bio", "psy"]
    : section === "C" ? ["eng", "acc", "bst", "eco", "mat"]
    : ["eng", "his", "pol", "eco", "psy"];
  return ids.map((id) => SUBJECTS[id]);
}

/** Weekly period allocation for timetable generation (40 periods/week). */
export function weeklyPlan(grade: GradeId, section: string): Record<string, number> {
  const subjects = examSubjects(grade, section).map((s) => s.id);
  const n = Number(grade);
  if (Number.isNaN(n)) return {};
  const plan: Record<string, number> = {};
  const core = n >= 11 ? 7 : n >= 9 ? 7 : n >= 6 ? 6 : 7;
  for (const s of subjects) plan[s] = s === "mat" || s === "eng" ? core : core - 1;
  plan.pe = 2;
  plan.lib = 1;
  if (n <= 8) {
    plan.art = 1;
    plan.mus = 1;
  }
  // top up / trim to exactly 40
  let total = Object.values(plan).reduce((a, b) => a + b, 0);
  const order = [...subjects];
  let i = 0;
  while (total < 40) {
    plan[order[i % order.length]]++;
    total++;
    i++;
  }
  while (total > 40) {
    const s = order[order.length - 1 - (i % order.length)];
    if (plan[s] > 4) {
      plan[s]--;
      total--;
    }
    i++;
  }
  return plan;
}

// ——— Houses ————————————————————————————————————————————————

export const HOUSES = [
  { id: "Aravali", color: "#C45A3C" },
  { id: "Nilgiri", color: "#3D6DB5" },
  { id: "Shivalik", color: "#1E8A5E" },
  { id: "Vindhya", color: "#D9961F" },
] as const;
export type House = (typeof HOUSES)[number]["id"];

// ——— Fees (annual tuition, before concessions) —————————————————————

export function annualTuition(grade: GradeId): number {
  const order = GRADE_BY_ID[grade].order;
  if (order <= 2) return 1_32_000;
  if (order <= 7) return 1_58_000;
  if (order <= 10) return 1_74_000;
  if (order <= 12) return 1_86_000;
  return 2_04_000;
}

export const TRANSPORT_QUARTERLY = 10_800;

export const INSTALMENTS = [
  { id: "Q1", label: "Quarter 1", month: 3, day: 10, covers: "Apr–Jun" },
  { id: "Q2", label: "Quarter 2", month: 6, day: 10, covers: "Jul–Sep" },
  { id: "Q3", label: "Quarter 3", month: 9, day: 10, covers: "Oct–Dec" },
  { id: "Q4", label: "Quarter 4", month: 0, day: 10, covers: "Jan–Mar" },
] as const;
export type InstalmentId = (typeof INSTALMENTS)[number]["id"];

/** Due date for an instalment in the academic year starting `startYear`. */
export function instalmentDue(id: InstalmentId, startYear: number): Date {
  const ins = INSTALMENTS.find((i) => i.id === id)!;
  return new Date(ins.month === 0 ? startYear + 1 : startYear, ins.month, ins.day);
}

// ——— Bell schedule (Classes I–XII) ——————————————————————————————

export const PERIODS = [
  { n: 1, start: "08:00", end: "08:40" },
  { n: 2, start: "08:40", end: "09:20" },
  { n: 3, start: "09:20", end: "10:00" },
  { n: 4, start: "10:00", end: "10:40" },
  { n: 0, start: "10:40", end: "11:00", label: "Break" },
  { n: 5, start: "11:00", end: "11:40" },
  { n: 6, start: "11:40", end: "12:20" },
  { n: 7, start: "12:20", end: "13:00" },
  { n: 0, start: "13:00", end: "13:30", label: "Lunch" },
  { n: 8, start: "13:30", end: "14:10" },
] as const;

export const TEACHING_PERIODS = PERIODS.filter((p) => p.n > 0);

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
