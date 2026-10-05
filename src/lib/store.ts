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
  /** homeworkId → submitted (parent view) */
  homeworkDone: Record<string, boolean>;
  /** studentId → reminder sent at (fees) */
  reminders: Record<string, string>;
  /** read notification ids */
  readNotifications: Record<string, true>;
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
  homeworkDone: {},
  reminders: {},
  readNotifications: {},
  registerMeta: {},
  studentLeave: [],
  attendanceAlerts: {},
  gradebook: {},
  reportCardsPublished: {},
  substitutions: {},
  busAbsence: {},
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
