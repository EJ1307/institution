// Admissions page helpers: stage navigation, eligibility and the activity
// timeline derived for each application.

import { hash01 } from "@/lib/rng";
import { ADMISSION_STAGES, type AdmissionStage, type Application } from "@/lib/data/admissions";
import { academicYear, addDays } from "@/lib/data/calendar";
import { GRADE_BY_ID, type GradeId } from "@/lib/data/school";
import type { AdmissionNote } from "@/lib/store";
import { dollars } from "@/lib/format";

export const STAGES = ADMISSION_STAGES as readonly AdmissionStage[];

export function stageIndex(s: AdmissionStage) {
  return (ADMISSION_STAGES as readonly string[]).indexOf(s);
}

export function nextStage(s: AdmissionStage): AdmissionStage | null {
  const i = stageIndex(s);
  return i >= 0 && i < ADMISSION_STAGES.length - 1 ? ADMISSION_STAGES[i + 1] : null;
}

export function prevStage(s: AdmissionStage): AdmissionStage | null {
  const i = stageIndex(s);
  return i > 0 ? ADMISSION_STAGES[i - 1] : null;
}

export const NEXT_STEP: Record<AdmissionStage, string> = {
  Enquiry: "Call back to schedule a campus tour",
  "Campus visit": "Book an interaction slot",
  Interaction: "Share the outcome with parents",
  "Offer made": "Awaiting fee payment",
  Enrolled: "Send the welcome kit and uniform list",
  Withdrawn: "No further action",
};

export const STAGE_TONE: Record<AdmissionStage, "neutral" | "info" | "brand" | "warn" | "good"> = {
  Enquiry: "neutral",
  "Campus visit": "info",
  Interaction: "brand",
  "Offer made": "warn",
  Enrolled: "good",
  Withdrawn: "neutral",
};

/** CBSE / Haryana age norm: completed years on 31 March of the admission year. */
export function ageCutoff() {
  const next = academicYear().startYear + 1;
  return new Date(next, 2, 31);
}

export function minAgeFor(grade: GradeId) {
  return 3 + GRADE_BY_ID[grade].order;
}

export function gradeName(g: GradeId) {
  return GRADE_BY_ID[g].label;
}

export function daysSince(d: Date, ref: Date) {
  return Math.max(0, Math.round((ref.getTime() - d.getTime()) / 86400000));
}

export type TimelineItem = { at: Date; title: string; body?: string; kind: "system" | "note" | "milestone" | "withdrawn" };

const SOURCE_TEXT: Record<string, string> = {
  Website: "Enquiry form submitted on the school website",
  "Walk-in": "Walked in at the admissions office",
  "Parent referral": "Referred by a current Laburnum parent",
  Instagram: "Responded to the admissions post on Instagram",
  "School fair": "Met the admissions team at a school fair",
  Newspaper: "Responded to the newspaper advertisement",
};

const WITHDRAW_REASONS = [
  "Family is relocating to Bengaluru",
  "Chose a school closer to home",
  "Fee structure above budget",
  "Got a seat at a sibling's school",
];

export function timelineFor(a: Application, notes: AdmissionNote[] = []): TimelineItem[] {
  const withdrawn = a.stage === "Withdrawn";
  const reached = withdrawn ? Math.floor(hash01("wd", a.id) * 3) : stageIndex(a.stage);
  const span = Math.max(1, Math.round((a.lastActivity.getTime() - a.createdOn.getTime()) / 86400000));
  const steps = reached + (withdrawn ? 1 : 0);
  const at = (i: number) => (steps === 0 ? a.createdOn : addDays(a.createdOn, Math.round((span * i) / Math.max(1, steps))));
  const items: TimelineItem[] = [{ at: a.createdOn, title: "Enquiry received", body: `${SOURCE_TEXT[a.source] ?? a.source} · ${a.parent}`, kind: "system" }];
  if (span >= 1 || reached > 0)
    items.push({
      at: addDays(a.createdOn, Math.min(1, span)),
      title: `${a.counsellor} called ${a.parent.split(" ")[0]}`,
      body: "Shared the prospectus and fee structure on WhatsApp",
      kind: "system",
    });
  if (reached >= 1) items.push({ at: at(1), title: "Campus visit", body: `Toured the ${GRADE_BY_ID[a.grade].order <= 7 ? "junior wing, activity rooms and the bus bay" : "senior wing, labs and library"} with ${a.counsellor}`, kind: "milestone" });
  if (reached >= 2)
    items.push({
      at: at(2),
      title: GRADE_BY_ID[a.grade].order <= 2 ? "Parent interaction" : "Student interaction",
      body: a.score ? `Assessed by the ${GRADE_BY_ID[a.grade].order <= 7 ? "Headmistress, Junior School" : "Senior School coordinator"} · score ${a.score}/100` : "Completed — outcome to be shared",
      kind: "milestone",
    });
  if (reached >= 3) items.push({ at: at(3), title: "Offer letter issued", body: `Seat held for 7 days · admission fee ${dollars(GRADE_BY_ID[a.grade].order <= 2 ? 55_000 : 75_000)}`, kind: "milestone" });
  if (reached >= 4) items.push({ at: at(4), title: "Fee paid — admission confirmed", body: "Paid online by UPI · admission number will be allotted in April", kind: "milestone" });
  if (withdrawn) items.push({ at: a.lastActivity, title: "Withdrawn", body: WITHDRAW_REASONS[Math.floor(hash01("wr", a.id) * WITHDRAW_REASONS.length)], kind: "withdrawn" });
  for (const n of notes) items.push({ at: new Date(n.at), title: `Note by ${n.by}`, body: n.text, kind: "note" });
  return items.sort((x, y) => y.at.getTime() - x.at.getTime());
}

