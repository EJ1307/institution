// Students and staff, generated deterministically.

import { Rng, clamp, hash01 } from "@/lib/rng";
import {
  BOY_NAMES, FATHER_NAMES, GIRL_NAMES, LOCALITIES, MOTHER_NAMES, OCCUPATIONS, SURNAMES,
} from "./names";
import { CLASSES, GRADE_BY_ID, HOUSES, type GradeId, type House } from "./school";
import { ROUTES, routeForLocality } from "./transport";

export type Guardian = {
  name: string;
  relation: "Father" | "Mother" | "Guardian";
  phone: string;
  occupation: string;
};

export type FeeProfile = "punctual" | "late" | "defaulter";

export type Student = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  name: string;
  gender: "F" | "M";
  grade: GradeId;
  section: string;
  classKey: string;
  roll: number;
  dob: string;
  house: House;
  bloodGroup: string;
  locality: string;
  routeId: string | null;
  guardians: Guardian[];
  joinedYear: number;
  /** probability of being present on an ordinary day */
  attendanceBase: number;
  /** latent ability (≈ N(0,1)) used to generate marks */
  ability: number;
  feeProfile: FeeProfile;
  concession: { label: string; pct: number } | null;
  tags: string[];
  parentId: string;
};

export type StaffCategory = "Leadership" | "Teaching" | "Co-curricular" | "Student support" | "Administration";

export type Staff = {
  id: string;
  title: "Dr." | "Mr." | "Ms." | "Mrs.";
  firstName: string;
  lastName: string;
  name: string;
  gender: "F" | "M";
  category: StaffCategory;
  designation: string;
  department: string;
  subjects: string[];
  /** stages taught: used for timetable assignment */
  teaches: ("pre" | "primary" | "middle" | "senior")[];
  classTeacherOf: string | null;
  qualification: string;
  joinedYear: number;
  experience: number;
  phone: string;
  email: string;
};

const BLOOD = ["B+", "O+", "A+", "AB+", "O−", "B−", "A−"];
const BLOOD_W = [32, 30, 22, 8, 3, 3, 2];

function phone(r: Rng) {
  const lead = r.pick(["98", "99", "97", "88", "81", "96", "70"]);
  const rest = String(r.int(10000000, 99999999));
  return `+91 ${lead}${rest.slice(0, 3)} ${rest.slice(3)}`;
}

// ——— Personas used by the demo logins ——————————————————————————————

export const PERSONA_PARENT = {
  id: "P-24071",
  name: "Rohan Mehta",
  children: ["S-AANYA", "S-VIHAAN"],
};

export const PERSONA_TEACHER_ID = "T-KAVYA";
export const PERSONA_ADMIN_ID = "T-PRINCIPAL";

// ——— Students ———————————————————————————————————————————————

function buildStudents(): Student[] {
  const r = new Rng("amaltas-students-v1");
  const out: Student[] = [];
  let serial = 1;
  const nowYear = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;

  for (const c of CLASSES) {
    const grade = GRADE_BY_ID[c.grade];
    const n = grade.size + r.int(-2, 2);
    const kids: Student[] = [];
    for (let i = 0; i < n; i++) {
      const gender: "F" | "M" = r.chance(0.48) ? "F" : "M";
      const firstName = gender === "F" ? r.pick(GIRL_NAMES) : r.pick(BOY_NAMES);
      const lastName = r.pick(SURNAMES);
      const ageYears = 3 + grade.order + (r.chance(0.3) ? 1 : 0);
      const dob = new Date(nowYear - ageYears, r.int(0, 11), r.int(1, 28));
      const locality = r.pick(LOCALITIES);
      const usesBus = r.chance(0.58);
      const joinedYear = clamp(nowYear - r.int(0, grade.order + 1), nowYear - 12, nowYear);
      const father = `${r.pick(FATHER_NAMES)} ${lastName === "Kaur" ? "Singh" : lastName}`;
      const mother = `${r.pick(MOTHER_NAMES)} ${lastName}`;
      const primaryIsMother = r.chance(0.45);
      const guardians: Guardian[] = [
        { name: father, relation: "Father", phone: phone(r), occupation: r.pick(OCCUPATIONS) },
        { name: mother, relation: "Mother", phone: phone(r), occupation: r.pick(OCCUPATIONS) },
      ];
      if (primaryIsMother) guardians.reverse();
      const feeRoll = r.next();
      const feeProfile: FeeProfile = feeRoll < 0.78 ? "punctual" : feeRoll < 0.95 ? "late" : "defaulter";
      const cRoll = r.next();
      const concession =
        cRoll < 0.06 ? { label: "Sibling", pct: 10 }
        : cRoll < 0.08 ? { label: "Merit scholarship", pct: 25 }
        : cRoll < 0.095 ? { label: "Staff ward", pct: 50 }
        : cRoll < 0.11 ? { label: "EWS (RTE)", pct: 100 }
        : null;
      // attendance: most kids 90–98%, a tail of chronic absentees
      const attendanceBase = clamp(r.chance(0.08) ? r.float(0.72, 0.86) : r.normal(0.945, 0.025), 0.65, 0.995);
      kids.push({
        id: "",
        admissionNo: "",
        firstName,
        lastName,
        name: `${firstName} ${lastName}`,
        gender,
        grade: c.grade,
        section: c.section,
        classKey: c.key,
        roll: 0,
        dob: dob.toISOString().slice(0, 10),
        house: r.pick(HOUSES).id,
        bloodGroup: r.weighted(BLOOD, BLOOD_W),
        locality,
        routeId: usesBus ? (routeForLocality(locality)?.id ?? null) : null,
        guardians,
        joinedYear,
        attendanceBase,
        ability: r.normal(0, 1),
        feeProfile,
        concession,
        tags: [],
        parentId: "",
      });
    }

    // Personas: Aanya (VII-A) and Vihaan (II-C) Mehta
    const persona = (first: string, gender: "F" | "M", ability: number) => {
      const k = kids[3];
      k.firstName = first;
      k.lastName = "Mehta";
      k.name = `${first} Mehta`;
      k.gender = gender;
      k.ability = ability;
      k.attendanceBase = 0.962;
      k.feeProfile = "punctual";
      k.concession = first === "Vihaan" ? { label: "Sibling", pct: 10 } : null;
      k.locality = "Sector 65";
      k.routeId = "R6";
      k.house = "Shivalik";
      k.guardians = [
        { name: "Rohan Mehta", relation: "Father", phone: "+91 98100 24071", occupation: "Product manager" },
        { name: "Shruti Mehta", relation: "Mother", phone: "+91 98100 63320", occupation: "Architect" },
      ];
      k.parentId = PERSONA_PARENT.id;
      k.id = first === "Aanya" ? "S-AANYA" : "S-VIHAAN";
    };
    if (c.key === "7-A") persona("Aanya", "F", 0.85);
    if (c.key === "2-C") persona("Vihaan", "M", 0.35);

    kids.sort((a, b) => a.firstName.localeCompare(b.firstName));
    kids.forEach((k, i) => {
      k.roll = i + 1;
      if (!k.id) k.id = `S${String(serial).padStart(4, "0")}`;
      k.admissionNo = `LA/${k.joinedYear}/${String(1000 + serial * 7 % 9000).padStart(4, "0")}`;
      if (!k.parentId) k.parentId = `P-${String(20000 + serial)}`;
      serial++;
    });
    out.push(...kids);
  }

  // One bus per route (40 or 52 seats): seats fill to roughly 84–96% and every
  // other family makes its own way, so no route is ever over capacity.
  for (const route of ROUTES) {
    const onRoute = out.filter((s) => s.routeId === route.id);
    const reserved = onRoute.filter((s) => s.parentId === PERSONA_PARENT.id).length;
    const seats = Math.round(route.capacity * (0.84 + hash01("fill", route.id) * 0.12)) - reserved;
    onRoute
      .filter((s) => s.parentId !== PERSONA_PARENT.id)
      .sort((a, b) => hash01("seat", a.id) - hash01("seat", b.id))
      .slice(Math.max(0, seats))
      .forEach((s) => (s.routeId = null));
  }

  // A few student leaders in the senior school
  const tag = (pred: (s: Student) => boolean, label: string) => {
    const s = out.find((x) => pred(x) && x.tags.length === 0);
    if (s) s.tags.push(label);
  };
  tag((s) => s.grade === "12" && s.gender === "F" && s.ability > 1, "Head girl");
  tag((s) => s.grade === "12" && s.gender === "M" && s.ability > 1, "Head boy");
  tag((s) => s.grade === "11" && s.ability > 0.4, "Sports captain");
  for (const h of HOUSES) tag((s) => s.grade === "12" && s.house === h.id && s.ability > 0.3, `${h.id} house captain`);
  return out;
}

// ——— Staff ————————————————————————————————————————————————————

type Seed = Omit<Staff, "id" | "firstName" | "lastName" | "name" | "gender" | "title" | "phone" | "email" | "joinedYear" | "experience" | "qualification"> & { qualification?: string };

function buildStaff(): Staff[] {
  const r = new Rng("amaltas-staff-v1");
  const out: Staff[] = [];
  const nowYear = new Date().getFullYear();
  const used = new Set<string>();

  const person = (gender: "F" | "M") => {
    for (;;) {
      const first = gender === "F" ? r.pick([...MOTHER_NAMES, "Kavita", "Sunita", "Rekha", "Seema", "Nandini", "Archana", "Preeti", "Mamta"]) : r.pick([...FATHER_NAMES, "Rakesh", "Sunil", "Mukesh", "Alok"]);
      const last = r.pick(SURNAMES.filter((s) => s !== "Kaur"));
      const key = `${first} ${last}`;
      if (!used.has(key)) {
        used.add(key);
        return { first, last };
      }
    }
  };

  const add = (seed: Seed, fixed?: { id: string; title: Staff["title"]; first: string; last: string; gender: "F" | "M"; joined: number; qualification: string }) => {
    const gender = fixed?.gender ?? (r.chance(seed.category === "Teaching" ? 0.72 : 0.5) ? "F" : "M");
    const nm = fixed ? { first: fixed.first, last: fixed.last } : person(gender);
    used.add(`${nm.first} ${nm.last}`);
    const title: Staff["title"] = fixed?.title ?? (gender === "M" ? "Mr." : r.chance(0.55) ? "Ms." : "Mrs.");
    const joinedYear = fixed?.joined ?? nowYear - r.int(0, 16);
    const id = fixed?.id ?? `T${String(out.length + 1).padStart(3, "0")}`;
    out.push({
      ...seed,
      id,
      title,
      firstName: nm.first,
      lastName: nm.last,
      name: `${nm.first} ${nm.last}`,
      gender,
      qualification: fixed?.qualification ?? seed.qualification ?? "B.Ed.",
      joinedYear,
      experience: nowYear - joinedYear + r.int(1, 9),
      phone: phone(r),
      email: `${nm.first}.${nm.last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@laburnumacademy.org",
    });
  };

  // Leadership
  add({ category: "Leadership", designation: "Principal", department: "Leadership", subjects: [], teaches: [], classTeacherOf: null },
    { id: PERSONA_ADMIN_ID, title: "Dr.", first: "Meenakshi", last: "Rao", gender: "F", joined: 2016, qualification: "Ph.D. (Education), M.Sc. Physics" });
  add({ category: "Leadership", designation: "Vice Principal", department: "Leadership", subjects: [], teaches: [], classTeacherOf: null },
    { id: "T-VP", title: "Mr.", first: "Arvind", last: "Khanna", gender: "M", joined: 2011, qualification: "M.A. English, M.Ed." });
  add({ category: "Leadership", designation: "Headmistress, Junior School", department: "Leadership", subjects: [], teaches: [], classTeacherOf: null },
    { id: "T-HM", title: "Mrs.", first: "Sunita", last: "Bhalla", gender: "F", joined: 2009, qualification: "M.A., B.Ed." });
  add({ category: "Leadership", designation: "Coordinator, Senior School", department: "Leadership", subjects: ["phy"], teaches: ["senior"], classTeacherOf: null, qualification: "M.Sc. Physics, B.Ed." });
  add({ category: "Leadership", designation: "Coordinator, Pre-primary", department: "Leadership", subjects: [], teaches: [], classTeacherOf: null, qualification: "M.A. Early Childhood Education" });

  // Pre-primary — one NTT per section
  for (const c of CLASSES.filter((x) => GRADE_BY_ID[x.grade].stage === "Pre-primary")) {
    add({ category: "Teaching", designation: "Pre-primary teacher (NTT)", department: "Pre-primary", subjects: ["eng", "mat", "evs"], teaches: ["pre"], classTeacherOf: c.key, qualification: "NTT, B.A." });
  }
  // Primary — class teachers teach Eng/Maths/EVS
  for (const c of CLASSES.filter((x) => GRADE_BY_ID[x.grade].stage === "Primary")) {
    add({ category: "Teaching", designation: "PRT", department: "Primary", subjects: ["eng", "mat", "evs"], teaches: ["primary"], classTeacherOf: c.key, qualification: "B.El.Ed." });
  }
  for (let i = 0; i < 5; i++) add({ category: "Teaching", designation: "PRT Hindi", department: "Languages", subjects: ["hin"], teaches: ["primary"], classTeacherOf: null, qualification: "M.A. Hindi, B.Ed." });
  for (let i = 0; i < 2; i++) add({ category: "Teaching", designation: "PRT Computers", department: "Computer Science", subjects: ["cs"], teaches: ["primary"], classTeacherOf: null, qualification: "MCA, B.Ed." });

  // Middle + secondary (VI–X) — TGTs
  const tgt: [string, string, string, number][] = [
    ["eng", "English", "Languages", 5],
    ["hin", "Hindi", "Languages", 4],
    ["mat", "Mathematics", "Mathematics", 4],
    ["sci", "Science", "Science", 4],
    ["sst", "Social Science", "Humanities", 4],
    ["skt", "Sanskrit", "Languages", 2],
    ["fre", "French", "Languages", 1],
  ];
  for (const [sub, name, dept, count] of tgt) {
    for (let i = 0; i < count; i++) {
      if (sub === "mat" && i === 1) {
        add({ category: "Teaching", designation: "TGT Mathematics", department: dept, subjects: ["mat"], teaches: ["middle"], classTeacherOf: "8-B" },
          { id: PERSONA_TEACHER_ID, title: "Ms.", first: "Kavya", last: "Iyer", gender: "F", joined: 2019, qualification: "M.Sc. Mathematics, B.Ed." });
        continue;
      }
      add({ category: "Teaching", designation: `TGT ${name}`, department: dept, subjects: [sub], teaches: ["middle"], classTeacherOf: null, qualification: `M.A./M.Sc. ${name}, B.Ed.` });
    }
  }

  // Senior secondary — PGTs
  const pgt: [string, string, string, number][] = [
    ["eng", "English", "Languages", 2],
    ["phy", "Physics", "Science", 2],
    ["che", "Chemistry", "Science", 2],
    ["bio", "Biology", "Science", 1],
    ["mat", "Mathematics", "Mathematics", 2],
    ["cs", "Computer Science", "Computer Science", 2],
    ["acc", "Accountancy", "Commerce", 1],
    ["bst", "Business Studies", "Commerce", 1],
    ["eco", "Economics", "Commerce", 2],
    ["his", "History", "Humanities", 1],
    ["pol", "Political Science", "Humanities", 1],
    ["psy", "Psychology", "Humanities", 1],
  ];
  for (const [sub, name, dept, count] of pgt) {
    for (let i = 0; i < count; i++) add({ category: "Teaching", designation: `PGT ${name}`, department: dept, subjects: [sub], teaches: ["senior"], classTeacherOf: null, qualification: `M.A./M.Sc. ${name}, B.Ed.` });
  }

  // Class teachers for VI–XII from the subject teachers
  const needCT = CLASSES.filter((x) => Number(x.grade) >= 6 && x.key !== "8-B");
  const pool = out.filter((s) => s.category === "Teaching" && (s.teaches.includes("middle") || s.teaches.includes("senior")) && !s.classTeacherOf);
  needCT.forEach((c, i) => {
    const senior = Number(c.grade) >= 11;
    const candidate = pool.find((p) => !p.classTeacherOf && p.teaches.includes(senior ? "senior" : "middle"));
    if (candidate) candidate.classTeacherOf = c.key;
    else if (pool[i]) pool[i].classTeacherOf ??= c.key;
  });

  // Co-curricular & support
  const misc: [StaffCategory, string, string, string[], number, string][] = [
    ["Co-curricular", "Physical Education teacher", "Sports", ["pe"], 5, "B.P.Ed."],
    ["Co-curricular", "Art teacher", "Arts", ["art"], 2, "BFA"],
    ["Co-curricular", "Music teacher", "Arts", ["mus"], 2, "M.A. Music"],
    ["Co-curricular", "Librarian", "Library", ["lib"], 2, "M.Lib.Sc."],
    ["Student support", "School counsellor", "Student support", [], 2, "M.A. Psychology"],
    ["Student support", "Special educator", "Student support", [], 1, "B.Ed. (Special Ed.)"],
    ["Student support", "School nurse", "Student support", [], 1, "B.Sc. Nursing"],
    ["Administration", "Accounts officer", "Accounts", [], 1, "M.Com."],
    ["Administration", "Accountant", "Accounts", [], 2, "B.Com."],
    ["Administration", "Admissions counsellor", "Admissions", [], 2, "MBA"],
    ["Administration", "Administrative officer", "Administration", [], 1, "MBA"],
    ["Administration", "Front office executive", "Administration", [], 2, "B.A."],
    ["Administration", "IT administrator", "IT", [], 1, "B.Tech."],
    ["Administration", "Transport manager", "Transport", [], 1, "B.A."],
    ["Administration", "Lab assistant", "Science", [], 3, "B.Sc."],
  ];
  for (const [category, designation, department, subjects, count, qualification] of misc) {
    for (let i = 0; i < count; i++) {
      add({ category, designation, department, subjects, teaches: subjects.length ? ["primary", "middle", "senior"] : [], classTeacherOf: null, qualification });
    }
  }
  return out;
}

let _students: Student[] | null = null;
let _staff: Staff[] | null = null;
let _byId: Map<string, Student> | null = null;
let _staffById: Map<string, Staff> | null = null;

export function students(): Student[] {
  return (_students ??= buildStudents());
}

export function staff(): Staff[] {
  return (_staff ??= buildStaff());
}

export function studentById(id: string): Student | undefined {
  _byId ??= new Map(students().map((s) => [s.id, s]));
  return _byId.get(id);
}

export function staffById(id: string): Staff | undefined {
  _staffById ??= new Map(staff().map((s) => [s.id, s]));
  return _staffById.get(id);
}

export function studentsInClass(classKey: string): Student[] {
  return students().filter((s) => s.classKey === classKey);
}

export function classTeacher(classKey: string): Staff | undefined {
  return staff().find((s) => s.classTeacherOf === classKey);
}

export function staffDisplayName(s: Staff) {
  return `${s.title} ${s.name}`;
}
