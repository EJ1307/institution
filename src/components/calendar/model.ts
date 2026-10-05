// Everything that goes on the school calendar: the live event list, exam
// windows, holidays (merged into spans), the fixed annual fixtures of the
// academic year, and events added in the demo.

import { academicYear, addDays, holidaysBetween, isoDate, nextSchoolDay, isWeekend } from "@/lib/data/calendar";
import { events, type SchoolEvent } from "@/lib/data/communication";
import { examsForYear } from "@/lib/data/exams";
import type { Student } from "@/lib/data/people";
import { fmtDay, fmtWeekday, startOfDay } from "@/lib/format";
import { reachesStudent, scopeFromLabel } from "@/components/comms/audience";

export type Kind = SchoolEvent["kind"];
export const KIND_ORDER: Kind[] = ["Academic", "Sports", "Cultural", "Holiday", "Meeting", "Trip"];

/** Calm categorical palette: series hues for the first four kinds, then neutral and teal. */
export const KIND_STYLE: Record<Kind, { dot: string; bg: string; fg: string }> = {
  Academic: { dot: "#3D6DB5", bg: "#E3E9F4", fg: "#2F4C7C" },
  Sports: { dot: "#1E8A5E", bg: "#DFEDE5", fg: "#245A43" },
  Cultural: { dot: "#C45A3C", bg: "#F4E4DD", fg: "#7E3F2E" },
  Holiday: { dot: "#D9961F", bg: "#F6EBD3", fg: "#76561A" },
  Meeting: { dot: "#7A7E85", bg: "#ECEBE6", fg: "#43474D" },
  Trip: { dot: "#2D8A8F", bg: "#DFEDEE", fg: "#215A5E" },
};

export type CalItem = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  time?: string;
  place?: string;
  kind: Kind;
  audience: string;
  note?: string;
  source: "event" | "exam" | "holiday" | "annual" | "added";
};

const NOTES: Record<string, string> = {
  E1: "Shivalik vs Nilgiri. Parents are welcome; please enter through Gate 3. Students who aren't playing watch from the east stand.",
  E2: "Buses leave school at 8:15 am and are back by 2:30 pm. Packed lunch is provided. Parents' consent is needed through the Notices page.",
  E3: "Slots are allotted alphabetically by first name; you can swap yours from the parent app until two days before. Students attend in school uniform.",
  E4: "Dance, drama, choir and anchoring. Students sign up with their class teacher; final cast is announced a week later.",
  E5: "Performances by Classes I and II, followed by tea in the junior wing courtyard. Two grandparents per child, please.",
  E6: "Class teachers will share the CBSE list: check the spelling of names, parents' names and dates of birth. Corrections are not accepted after this date.",
  E7: "Workshop on competency-based questions, led by the CBSE resource person for Gurugram. Please bring your draft question banks.",
  E8: "Amaltas MUN: 14 schools, 6 committees. Delegates report to the auditorium at 8:00 am both days.",
  E9: "Heats for 100 m, 200 m, 4 × 100 m relay and long jump. Finals are held on Annual Sports Day.",
};

function annualFixtures(y: number): CalItem[] {
  const d = (yy: number, m: number, day: number) => new Date(yy, m, day);
  const a = (id: string, title: string, start: Date, kind: Kind, audience: string, extra: Partial<CalItem> = {}): CalItem => ({ id: `A-${id}-${y}`, title, start, end: extra.end ?? start, kind, audience, source: "annual", ...extra });
  return [
    a("inv", "Investiture ceremony", d(y, 3, 24), "Cultural", "Classes VI–XII", { time: "9:00 am", place: "Auditorium", note: "Prefects, house captains and the student council take their oath. Parents of office-bearers are invited." }),
    a("orient", "Orientation for new parents", d(y, 3, 4), "Meeting", "Parents", { time: "10:00 am", place: "Auditorium", note: "An introduction to the school day, the parent app, fees and transport." }),
    a("ind", "Independence Day celebration", d(y, 7, 14), "Cultural", "Whole school", { time: "8:00 am", place: "Main field" }),
    a("tday", "Teachers' Day", d(y, 8, 4), "Cultural", "Whole school", { note: "Classes XI and XII take over the morning assembly and the first two periods." }),
    a("cday", "Children's Day", d(y, 10, 13), "Cultural", "Pre-primary & Primary", { time: "9:00 am", place: "Junior wing", note: "A morning of games and a puppet show. Students may come in colour dress." }),
    a("jaipur", "Class IX educational trip to Jaipur", d(y, 11, 2), "Trip", "Class IX", { end: d(y, 11, 4), note: "Amber Fort, Jantar Mantar and the City Palace. Consent and payment are collected through the parent app." }),
    a("preboard", "Pre-board examinations", d(y, 11, 7), "Academic", "Classes X & XII", { end: d(y, 11, 18), note: "Board pattern papers, full syllabus. Results are shared individually with parents." }),
    a("annual", "Annual Day", d(y, 11, 12), "Cultural", "Parents · Classes III–IX", { time: "5:00 pm", place: "Auditorium", note: "Two passes per family, issued through the parent app a week before." }),
    a("pract", "CBSE practical examinations", d(y + 1, 0, 5), "Academic", "Classes X & XII", { end: d(y + 1, 0, 30), note: "External examiners appointed by CBSE. Students are told their slot a week ahead." }),
    a("sports", "Annual Sports Day", d(y + 1, 0, 16), "Sports", "Classes I–XII", { time: "8:30 am", place: "Main field", note: "Athletics finals, house march past and prize distribution. Parents are welcome." }),
    a("rday", "Republic Day celebration", d(y + 1, 0, 25), "Cultural", "Whole school", { time: "8:00 am", place: "Main field" }),
    a("boards", "CBSE board examinations begin", d(y + 1, 1, 17), "Academic", "Classes X & XII", { note: "Admit cards are handed out by class teachers. The detailed date sheet is on the Exams page." }),
    a("termend", "Term-end staff meeting", d(y + 1, 2, 26), "Meeting", "Teaching staff", { time: "2:30 pm", place: "AV room" }),
  ];
}

let _holidayCache: { key: number; items: CalItem[] } | null = null;

/** Holidays for the academic year, with consecutive days of the same holiday merged into one span. */
function holidaySpans(y: number): CalItem[] {
  if (_holidayCache?.key === y) return _holidayCache.items;
  const days = holidaysBetween(new Date(y, 2, 1), new Date(y + 1, 3, 30));
  const out: CalItem[] = [];
  for (const h of days) {
    const last = out[out.length - 1];
    if (last && last.title === h.name) {
      // extend across a weekend gap
      let gapOk = true;
      for (let x = addDays(last.end, 1); x < h.date; x = addDays(x, 1)) if (!isWeekend(x)) gapOk = false;
      if (gapOk) {
        last.end = h.date;
        continue;
      }
    }
    out.push({ id: `H-${isoDate(h.date)}`, title: h.name, start: h.date, end: h.date, kind: "Holiday", audience: "School closed", source: "holiday" });
  }
  for (const h of out) h.note = `School and buses closed. Classes resume on ${fmtWeekday(nextSchoolDay(h.end))}.`;
  _holidayCache = { key: y, items: out };
  return out;
}

/** All calendar items for the academic years touching [from, to]. */
export function calendarItems(from: Date, to: Date): CalItem[] {
  const years = new Set([academicYear(from).startYear, academicYear(to).startYear]);
  const t = startOfDay(new Date());
  const live: CalItem[] = events()
    .filter((e) => !e.id.startsWith("H") && e.id !== "EX")
    .map((e) => ({
      id: e.id,
      title: e.title,
      start: startOfDay(e.date),
      end: startOfDay(e.end ?? e.date),
      time: e.time,
      place: e.place,
      kind: e.kind,
      audience: e.audience,
      note: NOTES[e.id],
      source: /^E\d+$/.test(e.id) ? "event" : "added",
    }));
  // fixtures close to today would collide with the live, date-relative events
  const near = (d: Date) => d.getTime() > t.getTime() - 5 * 86400000 && d.getTime() < t.getTime() + 28 * 86400000;
  const out: CalItem[] = [...live];
  for (const y of years) {
    out.push(...annualFixtures(y).filter((a) => !near(a.start)));
    out.push(...holidaySpans(y));
    for (const ex of examsForYear(y)) {
      out.push({ id: `X-${ex.id}`, title: ex.name, start: ex.start, end: ex.end, kind: "Academic", audience: "Classes I–XII", source: "exam", note: "The date sheet and syllabus are on the Exams page. Students leave after their paper; buses run at 12:30 pm." });
      out.push({ id: `R-${ex.id}`, title: `${ex.short} results on the portal`, start: ex.resultsOn, end: ex.resultsOn, kind: "Academic", audience: "Parents", source: "exam", note: "Report cards appear under Report card in the parent app from 4:00 pm." });
    }
  }
  const seen = new Set<string>();
  return out
    .filter((i) => i.end >= from && i.start <= to)
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime() || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

export function isStaffOnly(i: CalItem) {
  const s = scopeFromLabel(i.audience);
  return !s.parents;
}

/** Children an item concerns (holidays and whole-school items concern everyone). */
export function concerns(i: CalItem, kids: Student[]): Student[] {
  if (i.kind === "Holiday") return kids;
  const scope = scopeFromLabel(i.audience);
  return kids.filter((k) => reachesStudent(scope, k));
}

export function rangeLabel(i: CalItem) {
  if (i.start.getTime() === i.end.getTime()) return fmtWeekday(i.start);
  return i.start.getMonth() === i.end.getMonth() ? `${fmtWeekday(i.start)} – ${fmtWeekday(i.end)}` : `${fmtDay(i.start)} – ${fmtDay(i.end)}`;
}

/** "Today", "Tomorrow", "In 9 days", "3 days ago" — never a bare date. */
export function untilLabel(d: Date, t: Date) {
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}

export function spanDays(i: CalItem) {
  return Math.round((i.end.getTime() - i.start.getTime()) / 86400000) + 1;
}

// ——— .ics export ——————————————————————————————————————————————————

function icsDate(d: Date) {
  return isoDate(d).replace(/-/g, "");
}

function icsTime(d: Date, time: string) {
  const m = time.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === "pm") h += 12;
  return `${icsDate(d)}T${String(h).padStart(2, "0")}${m[2]}00`;
}

export function toIcs(i: CalItem, school: string) {
  const esc = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const timed = i.time ? icsTime(i.start, i.time) : null;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kaksha//School calendar//EN",
    "BEGIN:VEVENT",
    `UID:${i.id}@kaksha`,
    `DTSTAMP:${icsDate(new Date())}T000000Z`,
    timed ? `DTSTART;TZID=Asia/Kolkata:${timed}` : `DTSTART;VALUE=DATE:${icsDate(i.start)}`,
    timed ? `DURATION:PT2H` : `DTEND;VALUE=DATE:${icsDate(addDays(i.end, 1))}`,
    `SUMMARY:${esc(i.title)}`,
    `LOCATION:${esc([i.place, school].filter(Boolean).join(", "))}`,
    i.note ? `DESCRIPTION:${esc(i.note)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}
