// Profile-only details derived deterministically from the student record:
// medical notes, documents on file, absence notes and exam history.

import { hash01 } from "@/lib/rng";
import { markFor, studentSummary, type Mark } from "@/lib/data/attendance";
import { academicYear, addDays, isSchoolDay } from "@/lib/data/calendar";
import { classResults, examsForYear, publishedExams, reportCard, type Exam, type ReportCard } from "@/lib/data/exams";
import { studentsInClass, type Student } from "@/lib/data/people";
import { GRADE_BY_ID, GRADES } from "@/lib/data/school";

// ——— Medical ————————————————————————————————————————————————————

const ALLERGIES = ["Peanuts", "Dust mites", "Penicillin", "Lactose", "Eggs", "Seasonal pollen"];
const CONDITIONS = ["Mild asthma — inhaler kept with the school nurse", "Wears spectacles", "Eczema — avoid strong soaps", "Migraine — may need to rest in the infirmary"];

export function medicalFor(s: Student, ref: Date) {
  const age = ref.getFullYear() - Number(s.dob.slice(0, 4));
  const allergies = hash01("allergy", s.id) < 0.16 ? [ALLERGIES[Math.floor(hash01("allergy-k", s.id) * ALLERGIES.length)]] : [];
  const conditions = hash01("cond", s.id) < 0.1 ? [CONDITIONS[Math.floor(hash01("cond-k", s.id) * CONDITIONS.length)]] : [];
  // rough growth curve: ~6 cm a year to 12, then boys keep growing to 17 and girls level off by 15
  const teen = s.gender === "M" ? 4 * Math.max(0, Math.min(age, 17) - 12) : 2.4 * Math.max(0, Math.min(age, 15) - 12);
  const height = Math.round(76 + 6.3 * Math.min(age, 12) + teen + (hash01("h", s.id) - 0.5) * 10);
  const bmi = 14.6 + Math.max(0, age - 4) * 0.42 + (hash01("w", s.id) - 0.5) * 3;
  const weight = Math.round(bmi * (height / 100) ** 2);
  const checkup = new Date(academicYear(ref).startYear, 6, 14 + Math.floor(hash01("chk", s.id) * 12));
  const vision = hash01("vis", s.id) < 0.14 ? "6/9 — referred to an optometrist" : "6/6, both eyes";
  return { allergies, conditions, height, weight, checkup, vision };
}

// ——— Documents —————————————————————————————————————————————————

export type DocStatus = "verified" | "pending" | "missing" | "na";

export type StudentDoc = {
  id: string;
  name: string;
  detail: string;
  file: string | null;
  size: string | null;
  uploaded: Date | null;
  status: DocStatus;
  note?: string;
  required: boolean;
};

/** The grade a student first joined in, from their joining year. */
export function entryGrade(s: Student, ref: Date) {
  const years = academicYear(ref).startYear - s.joinedYear;
  const order = GRADE_BY_ID[s.grade].order - years;
  return GRADES.find((g) => g.order === Math.max(0, order)) ?? GRADES[0];
}

export function documentsFor(s: Student, ref: Date): StudentDoc[] {
  const ay = academicYear(ref);
  const joined = new Date(s.joinedYear, 2, 8 + Math.floor(hash01("joined", s.id) * 18));
  const entry = entryGrade(s, ref);
  const lateral = entry.order > 0;
  const kb = (k: string, lo: number, hi: number) => `${Math.round(lo + hash01("size", s.id, k) * (hi - lo))} KB`;
  const aadhaarTail = String(1000 + Math.floor(hash01("aadhaar", s.id) * 8999));
  const pendingAadhaar = hash01("doc-aadhaar", s.id) < 0.08;
  const medicalMissing = hash01("doc-med", s.id) < 0.14;
  const addressStale = hash01("doc-addr", s.id) < 0.07;
  const tcPending = hash01("doc-tc", s.id) < 0.18;
  const docs: StudentDoc[] = [
    {
      id: "birth",
      name: "Birth certificate",
      detail: "Municipal Corporation Gurugram · Reg. no. " + String(Math.floor(hash01("bc", s.id) * 9e5) + 1e5),
      file: "birth-certificate.pdf",
      size: kb("birth", 180, 620),
      uploaded: joined,
      status: "verified",
      required: true,
    },
    {
      id: "aadhaar",
      name: "Aadhaar card (student)",
      detail: `XXXX XXXX ${aadhaarTail}`,
      file: "aadhaar-student.pdf",
      size: kb("aadhaar", 90, 260),
      uploaded: pendingAadhaar ? addDays(ref, -3) : joined,
      status: pendingAadhaar ? "pending" : "verified",
      note: pendingAadhaar ? "Re-uploaded after an address update — awaiting the front office" : undefined,
      required: true,
    },
    {
      id: "photos",
      name: "Passport-size photographs",
      detail: `Updated for AY ${ay.label} · white background`,
      file: "photo-2026.jpg",
      size: kb("photo", 60, 140),
      uploaded: new Date(ay.startYear, 3, 6 + Math.floor(hash01("ph", s.id) * 10)),
      status: "verified",
      required: true,
    },
    lateral
      ? {
          id: "tc",
          name: "Transfer certificate",
          detail: `From previous school · countersigned by the District Education Officer`,
          file: tcPending ? null : "transfer-certificate.pdf",
          size: tcPending ? null : kb("tc", 220, 540),
          uploaded: tcPending ? null : joined,
          status: tcPending && s.joinedYear === ay.startYear ? "missing" : "verified",
          note: tcPending && s.joinedYear === ay.startYear ? `Original TC still to be submitted — joined ${entry.label} this year` : undefined,
          required: true,
        }
      : {
          id: "tc",
          name: "Transfer certificate",
          detail: `Not needed — joined in ${entry.label}, the school's entry class`,
          file: null,
          size: null,
          uploaded: null,
          status: "na",
          required: false,
        },
    lateral
      ? { id: "report", name: "Previous school report card", detail: `Final result before joining ${entry.label}`, file: "previous-report-card.pdf", size: kb("rc", 300, 900), uploaded: joined, status: "verified", required: true }
      : { id: "report", name: "Previous school report card", detail: "Not needed for an entry-class admission", file: null, size: null, uploaded: null, status: "na", required: false },
    {
      id: "address",
      name: "Address proof",
      detail: `${s.locality}, Gurugram · ${addressStale ? "rent agreement" : "electricity bill"}`,
      file: "address-proof.pdf",
      size: kb("addr", 120, 400),
      uploaded: addressStale ? new Date(ay.startYear - 1, 4, 12) : joined,
      status: addressStale ? "pending" : "verified",
      note: addressStale ? "Rent agreement expired in March — new proof requested" : undefined,
      required: true,
    },
    {
      id: "parent-id",
      name: "Parent ID proof",
      detail: `${s.guardians[0].name} · PAN card`,
      file: "parent-id.pdf",
      size: kb("pid", 80, 200),
      uploaded: joined,
      status: "verified",
      required: true,
    },
    {
      id: "medical",
      name: "Medical fitness certificate",
      detail: `For AY ${ay.label}, signed by a registered practitioner`,
      file: medicalMissing ? null : "medical-fitness.pdf",
      size: medicalMissing ? null : kb("med", 100, 300),
      uploaded: medicalMissing ? null : new Date(ay.startYear, 3, 3 + Math.floor(hash01("md", s.id) * 20)),
      status: medicalMissing ? "missing" : "verified",
      note: medicalMissing ? "Reminder sent with the PTM circular" : undefined,
      required: true,
    },
  ];
  if (s.concession?.label === "EWS (RTE)")
    docs.push({ id: "ews", name: "EWS certificate", detail: `Issued by the Tehsildar, Gurugram · valid till 31 Mar ${ay.startYear + 1}`, file: "ews-certificate.pdf", size: kb("ews", 150, 300), uploaded: joined, status: "verified", required: true });
  if (s.concession?.label === "Staff ward")
    docs.push({ id: "staff", name: "Staff ward declaration", detail: "Signed by the parent employed at the school", file: "staff-ward.pdf", size: kb("sw", 40, 90), uploaded: joined, status: "verified", required: true });
  return docs;
}

// ——— Attendance helpers ————————————————————————————————————————————

const ABSENT_NOTES = ["Fever — parent called the front office", "No reason given", "Family function", "Stomach upset", "No reason given", "Doctor's appointment", "Travelling — parent informed the class teacher"];
const LEAVE_NOTES = ["Leave applied in the app — viral fever", "Leave applied in the app — family wedding", "Leave applied in the app — dental appointment", "Leave applied in the app — out of station"];

export function markNote(s: Student, d: Date, m: Mark) {
  const h = hash01("note", s.id, d.getTime());
  if (m === "A") return ABSENT_NOTES[Math.floor(h * ABSENT_NOTES.length)];
  if (m === "E") return LEAVE_NOTES[Math.floor(h * LEAVE_NOTES.length)];
  if (m === "L") return `Arrived 8:${String(4 + Math.floor(hash01("min", s.id, d.getTime()) * 26)).padStart(2, "0")} am${s.routeId && h < 0.4 ? " — bus delayed on the route" : h < 0.7 ? " — signed in at the front desk" : ""}`;
  return "";
}

export function classRate(classKey: string, days: Date[]) {
  const list = studentsInClass(classKey);
  return list.reduce((a, x) => a + studentSummary(x, days).rate, 0) / (list.length || 1);
}

export type MonthRow = { month: Date; days: Date[]; rate: number; classRate: number; absent: number; late: number; leave: number };

export function monthsOfYear(s: Student, from: Date, to: Date): MonthRow[] {
  const out: MonthRow[] = [];
  for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const days: Date[] = [];
    for (let d = new Date(m); d.getMonth() === m.getMonth() && d <= to; d = addDays(d, 1)) if (isSchoolDay(d)) days.push(d);
    if (!days.length) {
      out.push({ month: m, days, rate: NaN, classRate: NaN, absent: 0, late: 0, leave: 0 });
      continue;
    }
    const sum = studentSummary(s, days);
    out.push({ month: m, days, rate: sum.rate, classRate: classRate(s.classKey, days), absent: sum.absent, late: sum.late, leave: sum.leave });
  }
  return out;
}

export function marksIn(s: Student, days: Date[]) {
  return days.map((d) => ({ d, m: markFor(s, d) })).filter((x): x is { d: Date; m: Mark } => x.m !== null && x.m !== "P");
}

// ——— Exams ————————————————————————————————————————————————————————

export type ExamRow = { exam: Exam; ay: string; rc: ReportCard; classAvg: number };

/** Published exams for this student, oldest first — last year's too if they were here. */
export function examHistory(s: Student, ref: Date): ExamRow[] {
  const ay = academicYear(ref);
  const prevGrade = GRADES.find((g) => g.order === GRADE_BY_ID[s.grade].order - 1);
  const prevHasMarks = prevGrade && !["N", "LKG", "UKG"].includes(prevGrade.id);
  const exams: { exam: Exam; ay: string }[] = [];
  if (s.joinedYear < ay.startYear && prevHasMarks) {
    const prev = academicYear(new Date(ay.startYear - 1, 5, 1));
    for (const e of examsForYear(ay.startYear - 1)) exams.push({ exam: e, ay: prev.label });
  }
  for (const e of publishedExams()) if (e.id.endsWith(String(ay.startYear))) exams.push({ exam: e, ay: ay.label });
  const out: ExamRow[] = [];
  for (const { exam, ay: label } of exams) {
    const rc = reportCard(s, exam);
    const cr = classResults(s.classKey, exam);
    if (rc && cr) out.push({ exam, ay: label, rc, classAvg: cr.avgPct });
  }
  return out;
}
