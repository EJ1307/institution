// Who a notice or event is for. Seeded data carries human labels ("Parents ·
// Classes VI–X", "Teaching staff"); notices composed in the demo also carry a
// structured key ("class:8-B", "route:R3"). Both resolve to the same Scope.

import { students, staff, studentsInClass, type Student } from "@/lib/data/people";
import { CLASSES, GRADES, GRADE_BY_ID, classLabel, type GradeId, type Stage } from "@/lib/data/school";
import { ROUTE_BY_ID, ROUTES } from "@/lib/data/transport";

export type Scope = {
  parents: boolean;
  staff: false | "all" | "teaching";
  /** null = every grade */
  grades: GradeId[] | null;
  classKey?: string;
  routeId?: string;
};

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
const ROMAN_RE = "XII|XI|IX|X|VIII|VII|VI|IV|V|III|II|I";
const STAGES: Stage[] = ["Pre-primary", "Primary", "Middle", "Secondary", "Senior secondary"];

export const STAGE_LABEL: Record<Stage, string> = {
  "Pre-primary": "Pre-primary (Nursery–UKG)",
  Primary: "Primary (I–V)",
  Middle: "Middle school (VI–VIII)",
  Secondary: "Secondary (IX–X)",
  "Senior secondary": "Senior secondary (XI–XII)",
};

const gradesOfStage = (st: Stage) => GRADES.filter((g) => g.stage === st).map((g) => g.id);
const numGrade = (n: number) => String(n) as GradeId;

/** Parse a human audience label into a scope. */
export function scopeFromLabel(label: string): Scope {
  const l = label.trim();
  const staffPart: Scope["staff"] = /staff/i.test(l) ? (/teaching/i.test(l) ? "teaching" : "all") : false;
  if (staffPart && !/parent|student/i.test(l)) return { parents: false, staff: staffPart, grades: null };

  const route = l.match(/Route\s+(R\d+)/i);
  if (route) return { parents: true, staff: false, grades: null, routeId: route[1].toUpperCase() };

  const cls = l.match(new RegExp(`\\b(${ROMAN_RE}|Nur|LKG|UKG)-([A-D])\\b`));
  if (cls) {
    const g = cls[1] === "Nur" ? "N" : ["LKG", "UKG"].includes(cls[1]) ? cls[1] : numGrade(ROMAN[cls[1]]);
    return { parents: true, staff: false, grades: [g as GradeId], classKey: `${g}-${cls[2]}` };
  }

  const grades = new Set<GradeId>();
  const range = l.match(new RegExp(`Classes\\s+(${ROMAN_RE})\\s*[–-]\\s*(${ROMAN_RE})\\b`));
  if (range) {
    for (let n = ROMAN[range[1]]; n <= ROMAN[range[2]]; n++) grades.add(numGrade(n));
  } else {
    const list = l.match(new RegExp(`Class(?:es)?\\s+((?:${ROMAN_RE})(?:\\s*(?:&|,|and)\\s*(?:${ROMAN_RE}))*)\\b`));
    if (list) list[1].split(/\s*(?:&|,|and)\s*/).forEach((r) => ROMAN[r] && grades.add(numGrade(ROMAN[r])));
  }
  for (const st of STAGES) {
    const re = st === "Primary" ? /(^|[^-])\bPrimary\b/i : st === "Secondary" ? /(^|[^r]\s)\bSecondary\b/i : new RegExp(`\\b${st}\\b`, "i");
    if (re.test(l)) gradesOfStage(st).forEach((g) => grades.add(g));
  }
  return { parents: true, staff: staffPart, grades: grades.size ? [...grades] : null };
}

/** Structured key (from the compose dialog) → scope. */
export function scopeFromKey(key: string): Scope {
  const [kind, v] = key.split(":");
  if (kind === "school") return { parents: true, staff: "all", grades: null };
  if (kind === "parents") return { parents: true, staff: false, grades: null };
  if (kind === "staff") return { parents: false, staff: v === "teaching" ? "teaching" : "all", grades: null };
  if (kind === "stage") return { parents: true, staff: false, grades: gradesOfStage(v as Stage) };
  if (kind === "grade") return { parents: true, staff: false, grades: [v as GradeId] };
  if (kind === "class") return { parents: true, staff: false, grades: [v.split("-")[0] as GradeId], classKey: v };
  if (kind === "route") return { parents: true, staff: false, grades: null, routeId: v };
  return { parents: true, staff: false, grades: null };
}

export function scopeOf(x: { audience: string; audienceKey?: string }): Scope {
  return x.audienceKey ? scopeFromKey(x.audienceKey) : scopeFromLabel(x.audience);
}

export function reachesStudent(scope: Scope, s: Student): boolean {
  if (!scope.parents) return false;
  if (scope.routeId) return s.routeId === scope.routeId;
  if (scope.classKey) return s.classKey === scope.classKey;
  if (!scope.grades) return true;
  return scope.grades.includes(s.grade);
}

/** Which of a parent's children a scope concerns. */
export function childrenReached(scope: Scope, kids: Student[]): Student[] {
  return kids.filter((k) => reachesStudent(scope, k));
}

// ——— Compose options ————————————————————————————————————————————

export type AudienceKind = "school" | "class" | "staff" | "route";

/** Families for anything wider than a class are a little fewer than students (siblings). */
const SIBLING_FACTOR = 1457 / 1557;

export function familiesInGrades(grades: GradeId[]) {
  return students().filter((s) => grades.includes(s.grade)).length;
}

export function recipientsFor(key: string): { count: number; noun: string } {
  const [kind, v] = key.split(":");
  if (kind === "school") return { count: 1457 + staff().length, noun: "families and staff" };
  if (kind === "parents") return { count: 1457, noun: "families" };
  if (kind === "staff") return { count: v === "teaching" ? staff().filter((s) => s.category === "Teaching").length : staff().length, noun: "staff" };
  if (kind === "class") return { count: studentsInClass(v).length, noun: "families" };
  if (kind === "route") return { count: students().filter((s) => s.routeId === v).length, noun: "families" };
  const grades = kind === "stage" ? gradesOfStage(v as Stage) : [v as GradeId];
  const n = familiesInGrades(grades);
  return { count: kind === "stage" ? Math.round(n * SIBLING_FACTOR) : n, noun: "families" };
}

export function audienceLabel(key: string): string {
  const [kind, v] = key.split(":");
  if (kind === "school") return "All parents & staff";
  if (kind === "parents") return "All parents";
  if (kind === "staff") return v === "teaching" ? "Teaching staff" : "All staff";
  if (kind === "stage") return `Parents · ${STAGE_LABEL[v as Stage]}`;
  if (kind === "grade") return `Parents · ${GRADE_BY_ID[v as GradeId].label}`;
  if (kind === "class") {
    const [g, s] = v.split("-");
    return `Parents · ${classLabel(g as GradeId, s)}`;
  }
  if (kind === "route") return `Parents · Route ${v} (${ROUTE_BY_ID[v]?.name ?? ""})`;
  return "All parents";
}

export const CLASS_TARGETS = {
  stages: STAGES.map((st) => ({ key: `stage:${st}`, label: STAGE_LABEL[st] })),
  grades: GRADES.map((g) => ({
    key: `grade:${g.id}`,
    label: `${g.label} — all sections`,
    sections: CLASSES.filter((c) => c.grade === g.id).map((c) => ({ key: `class:${c.key}`, label: classLabel(c.grade, c.section) })),
  })),
};

export const ROUTE_TARGETS = ROUTES.map((r) => ({ key: `route:${r.id}`, label: `${r.id} · ${r.name}` }));

// ——— Small numeric helpers ————————————————————————————————————————

/** Split an integer total across weights (largest remainder), so parts always add up. */
export function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f);
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}

/** Like apportion, but no part may exceed its cap. */
export function apportionCapped(total: number, weights: number[], caps: number[]): number[] {
  const out = apportion(Math.min(total, caps.reduce((a, b) => a + b, 0)), weights).map((v, i) => Math.min(v, caps[i]));
  let left = Math.min(total, caps.reduce((a, b) => a + b, 0)) - out.reduce((a, b) => a + b, 0);
  for (let guard = 0; left > 0 && guard < 10000; guard++) {
    const i = guard % out.length;
    if (out[i] < caps[i]) {
      out[i]++;
      left--;
    }
  }
  return out;
}
