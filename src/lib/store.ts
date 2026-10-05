// A tiny persistent store for the things people *do* in the demo — marking
// attendance, paying a fee, posting a notice — so actions survive reloads and
// show up across roles (mark VIII-B as a teacher, then see it as the principal).

import { useSyncExternalStore } from "react";

export type AttendanceMark = "P" | "A" | "L" | "E";
export type Role = "admin" | "teacher" | "parent";

export type PostedNotice = {
  id: string;
  title: string;
  body: string;
  audience: string;
  category: string;
  author: string;
  postedAt: string; // ISO datetime
  requiresAck: boolean;
  /** structured audience, e.g. "school", "parents", "stage:Middle", "grade:7", "class:8-B", "route:R3", "staff:teaching" */
  audienceKey?: string;
  /** number of families / staff the notice goes to */
  reachTotal?: number;
  channels?: string[];
  /** posted for later: postedAt is then the scheduled send time */
  scheduled?: boolean;
};

/** A calendar event added from the demo (Calendar → Add event). */
export type PostedEvent = {
  id: string;
  title: string;
  date: string; // ISO date
  end?: string; // ISO date, multi-day events
  time?: string;
  place?: string;
  kind: string;
  audience: string;
  createdAt: string; // ISO datetime
};

/** Homework set by a teacher from the demo (Homework → Set homework). */
export type PostedHomework = {
  id: string;
  classKey: string;
  subject: string;
  title: string;
  detail: string;
  assignedOn: string; // ISO date
  dueOn: string; // ISO date
  attachment?: string;
  setBy: string;
};

/** An admissions enquiry added from the demo (Admissions → New enquiry). */
export type StoredEnquiry = {
  id: string;
  child: string;
  gender: "F" | "M";
  dob: string; // ISO date
  grade: string;
  parent: string;
  phone: string;
  email: string;
  locality: string;
  source: string;
  sibling: boolean;
  createdOn: string; // ISO datetime
};

export type AdmissionNote = { text: string; at: string; by: string };

/** School-level settings edited in Settings (identity colours live in brand.ts). */
export type SchoolSettings = {
  profile?: Record<string, string>;
  /** "eventId|channel" → enabled */
  notifications?: Record<string, boolean>;
  /** integrationId → connected */
  integrations?: Record<string, boolean>;
  twoFactor?: boolean;
  sessionTimeout?: string;
};

/** A parent's leave application for their child. */
export type StudentLeave = {
  id: string;
  studentId: string;
  from: string; // ISO date
  to: string; // ISO date
  reason: string;
  details: string;
  appliedAt: string; // ISO datetime
};

export type AppState = {
  session: { role: Role; userId: string; name: string } | null;
  /** parent view: which child is selected */
  childId: string;
  /** classKey|isoDate → studentId → mark */
  attendance: Record<string, Record<string, AttendanceMark>>;
  /** studentId|instalmentId → payment (reference/at/source only on payments made in the demo) */
  payments: Record<string, { paidOn: string; mode: string; receipt: string; reference?: string; at?: string; source?: "parent" | "office" }>;
  notices: PostedNotice[];
  /** noticeId → acknowledged (parent) */
  acks: Record<string, string>;
  /** leaveId → decision */
  leaveDecisions: Record<string, "approved" | "declined">;
  /** applicationId → stage */
  admissionStages: Record<string, string>;
  /** enquiries added in the demo */
  newEnquiries: StoredEnquiry[];
  /** applicationId → counsellor notes */
  admissionNotes: Record<string, AdmissionNote[]>;
  /** leaveId → substitute teacher chosen when approving */
  leaveSubstitutes: Record<string, string>;
  /** homeworkId → submitted (parent view) */
  homeworkDone: Record<string, boolean>;
  /** studentId → reminder sent at (fees) */
  reminders: Record<string, string>;
  /** read notification ids */
  readNotifications: Record<string, true>;
  /** calendar events added in the demo */
  events: PostedEvent[];
  /** homework set in the demo */
  homework: PostedHomework[];
  /** noticeId → when the parent opened it */
  noticesRead: Record<string, string>;
  /** "notice:<id>" / "hw:<id>" → when non-responders were last reminded */
  nudges: Record<string, string>;
  /** classKey|isoDate → when the teacher submitted the register, with notes on absences */
  registerMeta: Record<string, { submittedAt: string; notes: Record<string, string> }>;
  /** leave applied for a child by a parent (Attendance → Apply for leave) */
  studentLeave: StudentLeave[];
  /** studentId → when parents were alerted about low attendance */
  attendanceAlerts: Record<string, string>;
  /** examId|classKey|subjectId → marks entered in the gradebook */
  gradebook: Record<string, { marks: Record<string, number | "AB">; submittedAt?: string }>;
  /** examId → when report cards were published to parents */
  reportCardsPublished: Record<string, string>;
  /** isoDate|teacherId|periodIndex → substitute teacher id */
  substitutions: Record<string, string>;
  /** studentId|isoDate → reported at: parent says the child won't take the bus that day */
  busAbsence: Record<string, string>;
  /** Settings → school profile, notification channels, integrations, security */
  settings: SchoolSettings;
};

const KEY = "kaksha.demo.v1";

const initial: AppState = {
  session: null,
  childId: "S-AANYA",
  attendance: {},
  payments: {},
  notices: [],
  acks: {},
  leaveDecisions: {},
  admissionStages: {},
  newEnquiries: [],
  admissionNotes: {},
  leaveSubstitutes: {},
  homeworkDone: {},
  reminders: {},
  readNotifications: {},
  events: [],
  homework: [],
  noticesRead: {},
  nudges: {},
  registerMeta: {},
  studentLeave: [],
  attendanceAlerts: {},
  gradebook: {},
  reportCardsPublished: {},
  substitutions: {},
  busAbsence: {},
  settings: {},
};

let state: AppState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch {
    // storage unavailable (private mode) — the demo still works in-memory
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function getState(): AppState {
  load();
  return state;
}

export function setState(update: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  load();
  const patch = typeof update === "function" ? update(state) : update;
  state = { ...state, ...patch };
  persist();
  listeners.forEach((l) => l());
}

export function resetDemo() {
  const session = state.session;
  state = { ...initial, session };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      loaded = false;
      load();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const serverSnapshot = () => initial;

/** Subscribe a component to (a slice of) the store. */
export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(getState()),
    () => select(serverSnapshot()),
  );
}
