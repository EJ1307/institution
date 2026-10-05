// Admissions pipeline for the coming academic year.

import { Rng } from "@/lib/rng";
import { getState } from "@/lib/store";
import { academicYear, addDays, today } from "./calendar";
import { BOY_NAMES, FATHER_NAMES, GIRL_NAMES, LOCALITIES, MOTHER_NAMES, SURNAMES } from "./names";
import { GRADES, type GradeId } from "./school";
import { staff } from "./people";

export const ADMISSION_STAGES = ["Enquiry", "Campus visit", "Interaction", "Offer made", "Enrolled"] as const;
export type AdmissionStage = (typeof ADMISSION_STAGES)[number] | "Withdrawn";

export const SOURCES = ["Website", "Walk-in", "Parent referral", "Instagram", "School fair", "Newspaper"] as const;

export type Application = {
  id: string;
  child: string;
  gender: "F" | "M";
  dob: Date;
  grade: GradeId;
  parent: string;
  phone: string;
  locality: string;
  source: (typeof SOURCES)[number];
  stage: AdmissionStage;
  createdOn: Date;
  lastActivity: Date;
  nextStep: string;
  counsellor: string;
  sibling: boolean;
  score: number | null;
};

/** Seats open for the coming year, by grade. */
export const SEATS: Partial<Record<GradeId, number>> = {
  N: 72, LKG: 8, UKG: 6, "1": 12, "2": 6, "3": 5, "4": 4, "5": 4, "6": 8, "7": 4, "8": 3, "9": 6, "11": 32,
};

const NEXT: Record<string, string> = {
  Enquiry: "Call back to schedule a campus tour",
  "Campus visit": "Book interaction slot",
  Interaction: "Share outcome with parents",
  "Offer made": "Awaiting fee payment",
  Enrolled: "Send welcome kit",
  Withdrawn: "—",
};

let cache: { key: string; list: Application[] } | null = null;

export function applications(): Application[] {
  const overrides = getState().admissionStages;
  const added = getState().newEnquiries ?? [];
  const key = JSON.stringify(overrides) + today().getTime() + "|" + added.length;
  if (cache?.key === key) return cache.list;

  const r = new Rng("amaltas-admissions-v1");
  const t = today();
  const counsellors = staff().filter((s) => s.designation === "Admissions counsellor");
  const grades = GRADES.filter((g) => SEATS[g.id]);
  const weights = grades.map((g) => (g.id === "N" ? 9 : g.id === "11" ? 4 : g.id === "LKG" ? 3 : 1.4));
  const list: Application[] = [];
  const total = 236;
  for (let i = 0; i < total; i++) {
    const gender: "F" | "M" = r.chance(0.5) ? "F" : "M";
    const last = r.pick(SURNAMES);
    const grade = r.weighted(grades, weights).id;
    const age = 3 + GRADES.find((g) => g.id === grade)!.order;
    const createdOn = addDays(t, -r.int(0, 80));
    // older enquiries have progressed further
    const ageDays = (t.getTime() - createdOn.getTime()) / 86400000;
    const progress = Math.min(4, Math.floor(r.next() * (1 + ageDays / 16)));
    let stage: AdmissionStage = ADMISSION_STAGES[progress];
    if (r.chance(0.07)) stage = "Withdrawn";
    const id = `ENQ-${academicYear(t).nextLabel.slice(2, 4)}${academicYear(t).nextLabel.slice(5)}-${String(1001 + i)}`;
    if (overrides[id]) stage = overrides[id] as AdmissionStage;
    const parentFirst = r.chance(0.55) ? r.pick(FATHER_NAMES) : r.pick(MOTHER_NAMES);
    list.push({
      id,
      child: `${gender === "F" ? r.pick(GIRL_NAMES) : r.pick(BOY_NAMES)} ${last}`,
      gender,
      dob: new Date(t.getFullYear() - age, r.int(0, 11), r.int(1, 28)),
      grade,
      parent: `${parentFirst} ${last}`,
      phone: `+91 9${r.int(100000000, 999999999)}`.replace(/(\+91 \d{5})(\d{5})/, "$1 $2"),
      locality: r.pick(LOCALITIES),
      source: r.weighted(SOURCES, [30, 18, 24, 16, 7, 5]),
      stage,
      createdOn,
      lastActivity: addDays(createdOn, Math.min(Math.floor(ageDays), r.int(0, 14))),
      nextStep: NEXT[stage],
      counsellor: counsellors.length ? `${counsellors[i % counsellors.length].title} ${counsellors[i % counsellors.length].name}` : "Admissions office",
      sibling: r.chance(0.14),
      score: progress >= 3 ? r.int(62, 98) : null,
    });
  }
  // enquiries added in the demo (Admissions → New enquiry)
  for (const e of added) {
    const stage = (overrides[e.id] as AdmissionStage) ?? "Enquiry";
    const created = new Date(e.createdOn);
    list.push({
      id: e.id, child: e.child, gender: e.gender, dob: new Date(e.dob), grade: e.grade as GradeId, parent: e.parent, phone: e.phone,
      locality: e.locality, source: e.source as Application["source"], stage, createdOn: created, lastActivity: created,
      nextStep: NEXT[stage], counsellor: counsellors.length ? `${counsellors[0].title} ${counsellors[0].name}` : "Admissions office",
      sibling: e.sibling, score: null,
    });
  }
  list.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  cache = { key, list };
  return list;
}

export function funnel() {
  const apps = applications().filter((a) => a.stage !== "Withdrawn");
  // a funnel counts everyone who reached at least that stage
  return ADMISSION_STAGES.map((stage, i) => ({
    stage,
    count: apps.filter((a) => ADMISSION_STAGES.indexOf(a.stage as (typeof ADMISSION_STAGES)[number]) >= i).length,
  }));
}
