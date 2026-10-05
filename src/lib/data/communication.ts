// Notices, events and homework. Dates are relative to today so the demo
// always looks current.

import { hash01 } from "@/lib/rng";
import { getState } from "@/lib/store";
import { addDays, fromIso, holidaysBetween, isoDate, nextSchoolDay, toSchoolDay, today } from "./calendar";
import { latestExam, upcomingExam } from "./exams";
import { examSubjects, SUBJECTS } from "./school";

export type Notice = {
  id: string;
  title: string;
  body: string;
  audience: string;
  category: "Academic" | "Events" | "Fees" | "Transport" | "Health & safety" | "Administrative";
  author: string;
  postedAt: Date;
  requiresAck: boolean;
  reach: { read: number; total: number };
  pinned?: boolean;
};

export function notices(): Notice[] {
  const t = today();
  const at = (days: number, h = 9, m = 0) => {
    const d = addDays(t, days);
    d.setHours(h, m);
    return d;
  };
  const exam = latestExam();
  const next = upcomingExam();
  const seeded: Notice[] = [
    {
      id: "N1",
      title: `${exam.name} results are now on the portal`,
      body: "Report cards can be viewed and downloaded from the Academics section. Class teachers will share subject-wise feedback during the PTM. Please write to your class teacher if you have questions about a specific paper.",
      audience: "All parents · Classes I–XII",
      category: "Academic",
      author: "Office of the Principal",
      postedAt: at(-3, 16, 30),
      requiresAck: false,
      reach: { read: 1184, total: 1366 },
      pinned: true,
    },
    {
      id: "N2",
      title: "Parent–teacher meeting, Classes VI–X",
      body: `PTM will be held on ${fmtShort(toSchoolDay(addDays(t, 12)))}, 8:30 am – 12:30 pm. Slots are allotted alphabetically by first name; you can swap your slot from the parent app until two days before. Students attend in school uniform.`,
      audience: "Parents · Classes VI–X",
      category: "Academic",
      author: "Mr. Arvind Khanna, Vice Principal",
      postedAt: at(-1, 11, 15),
      requiresAck: true,
      reach: { read: 412, total: 541 },
    },
    {
      id: "N3",
      title: "Class VII science museum visit — consent needed",
      body: `Class VII will visit the National Science Centre, Pragati Maidan on ${fmtShort(toSchoolDay(addDays(t, 9)))}. Buses leave school at 8:15 am and return by 2:30 pm. Packed lunch will be provided. Please give consent by ${fmtShort(toSchoolDay(addDays(t, 5)))}.`,
      audience: "Parents · Class VII",
      category: "Events",
      author: "Ms. Nandini Ghosh, Science department",
      postedAt: at(-2, 13, 0),
      requiresAck: true,
      reach: { read: 88, total: 104 },
    },
    {
      id: "N4",
      title: "Quarter 3 fee instalment reminder",
      body: "The Quarter 3 instalment (October–December) is due on the 10th. Pay through the portal by UPI, card or net banking — receipts are generated instantly. A late fee of ₹500 applies after 15 days.",
      audience: "All parents",
      category: "Fees",
      author: "Accounts office",
      postedAt: at(-6, 10, 0),
      requiresAck: false,
      reach: { read: 1302, total: 1457 },
    },
    {
      id: "N5",
      title: "Air quality: outdoor activity moves indoors above AQI 300",
      body: "With the season changing, assembly, PE and recess will move indoors on days when the AQI at school crosses 300. Air purifiers have been serviced in all classrooms. Students with asthma should carry their inhalers.",
      audience: "All parents & staff",
      category: "Health & safety",
      author: "Dr. Meenakshi Rao, Principal",
      postedAt: at(-8, 8, 30),
      requiresAck: false,
      reach: { read: 1388, total: 1569 },
    },
    {
      id: "N6",
      title: "Route R3 (Nirvana Country) — revised pick-up times",
      body: "Owing to road work near South City II, Route R3 will leave its first stop 5 minutes earlier, at 6:53 am, until further notice. Afternoon drop timings are unchanged.",
      audience: "Parents · Route R3",
      category: "Transport",
      author: "Transport office",
      postedAt: at(-4, 17, 45),
      requiresAck: true,
      reach: { read: 61, total: 74 },
    },
    {
      id: "N7",
      title: next ? `${next.name}: syllabus and date sheet` : "Date sheet for the next examination",
      body: next ? `${next.name} begins on ${fmtShort(next.start)}. Subject-wise syllabus has been shared on the portal under Academics → Exams. Remedial classes for Classes IX–XII run every Saturday until then.` : "The date sheet will be shared shortly.",
      audience: "Students & parents · Classes VI–XII",
      category: "Academic",
      author: "Examination cell",
      postedAt: at(-10, 15, 0),
      requiresAck: false,
      reach: { read: 702, total: 823 },
    },
    {
      id: "N8",
      title: "Staff meeting: competency-based assessment planning",
      body: "All teachers of Classes VI–XII, Thursday at 2:30 pm in the AV room. Please bring your draft question banks for the next periodic test.",
      audience: "Teaching staff",
      category: "Administrative",
      author: "Mr. Arvind Khanna, Vice Principal",
      postedAt: at(-1, 8, 10),
      requiresAck: true,
      reach: { read: 54, total: 68 },
    },
  ];
  const posted: Notice[] = getState().notices.map((n) => ({
    ...n,
    category: n.category as Notice["category"],
    postedAt: new Date(n.postedAt),
    reach: { read: 0, total: n.reachTotal ?? 1457 },
  }));
  return [...posted, ...seeded].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.postedAt.getTime() - a.postedAt.getTime());
}

function fmtShort(d: Date) {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// ——— Events ————————————————————————————————————————————————————

export type SchoolEvent = {
  id: string;
  title: string;
  date: Date;
  end?: Date;
  time?: string;
  place?: string;
  kind: "Academic" | "Sports" | "Cultural" | "Holiday" | "Meeting" | "Trip";
  audience: string;
};

export function events(): SchoolEvent[] {
  const t = today();
  const at = (n: number) => toSchoolDay(addDays(t, n));
  const list: SchoolEvent[] = [
    { id: "E1", title: "Inter-house football final", date: at(3), time: "2:30 pm", place: "Main field", kind: "Sports", audience: "Classes VI–XII" },
    { id: "E2", title: "Class VII science museum visit", date: at(9), time: "8:15 am", place: "National Science Centre", kind: "Trip", audience: "Class VII" },
    { id: "E3", title: "PTM — Classes VI to X", date: at(12), time: "8:30 am", place: "Classrooms", kind: "Meeting", audience: "Parents" },
    { id: "E4", title: "Annual Day auditions", date: at(6), time: "1:30 pm", place: "Auditorium", kind: "Cultural", audience: "Classes III–IX" },
    { id: "E5", title: "Grandparents' Day", date: at(17), time: "10:00 am", place: "Junior wing", kind: "Cultural", audience: "Pre-primary & Primary" },
    { id: "E6", title: "CBSE registration — Classes IX & XI, last date", date: at(15), kind: "Academic", audience: "Classes IX & XI" },
    { id: "E7", title: "Staff development workshop", date: at(20), time: "2:30 pm", place: "AV room", kind: "Meeting", audience: "Teaching staff" },
    { id: "E8", title: "Inter-school MUN", date: at(24), end: at(25), place: "Auditorium", kind: "Academic", audience: "Classes IX–XII" },
    { id: "E9", title: "Athletics meet — heats", date: at(-2), time: "8:00 am", place: "Track", kind: "Sports", audience: "Classes III–XII" },
  ];
  const exam = upcomingExam();
  if (exam && exam.start > t) list.push({ id: "EX", title: `${exam.name} begins`, date: exam.start, end: exam.end, kind: "Academic", audience: "Classes I–XII" });
  for (const h of holidaysBetween(addDays(t, -7), addDays(t, 60))) {
    list.push({ id: `H${isoDate(h.date)}`, title: h.name, date: h.date, kind: "Holiday", audience: "School closed" });
  }
  for (const e of getState().events ?? []) {
    list.push({ ...e, kind: e.kind as SchoolEvent["kind"], date: fromIso(e.date), end: e.end ? fromIso(e.end) : undefined });
  }
  return list.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function upcomingEvents(n = 5) {
  const t = today();
  return events().filter((e) => (e.end ?? e.date) >= t).slice(0, n);
}

// ——— Homework ——————————————————————————————————————————————————

export type Homework = {
  id: string;
  classKey: string;
  subject: string;
  title: string;
  detail: string;
  assignedOn: Date;
  dueOn: Date;
  /** set from the demo (Homework → Set homework) */
  setBy?: string;
  attachment?: string;
};

const TASKS: Record<string, [string, string][]> = {
  eng: [["Read chapter 6 and write a 150-word summary", "Focus on how the narrator's view of the city changes."], ["Letter to the editor", "Write about traffic near the school gate. Use the format discussed in class."], ["Vocabulary: 15 new words", "Use each in a sentence from your own life."]],
  hin: [["पाठ 5 के प्रश्न-उत्तर", "Write answers in your Hindi notebook; neat handwriting counts."], ["अनुच्छेद लेखन: मेरा प्रिय त्योहार", "120–150 words."]],
  mat: [["Exercise 4.3, questions 1–12", "Show all working. Q10–12 are challenge questions — attempt them."], ["Worksheet: linear equations", "Printed worksheet given in class. Bring it on the due date."], ["Practice: data handling", "Draw a bar graph of the heights of 10 family members or neighbours."]],
  sci: [["Lab record: separation of mixtures", "Complete the observation table and the conclusion."], ["Model: water cycle", "Use recycled materials only. Group of three."]],
  sst: [["Map work: rivers of India", "Mark and label the major rivers on the outline map."], ["Read: the Mughal empire", "Make a timeline of the key rulers."]],
  evs: [["Plant a seed and keep a diary", "Note how tall it grows every two days."], ["Collect five types of leaves", "Paste them in your scrapbook and name the plants."]],
  cs: [["Typing practice — 15 minutes daily", "Use the home-row exercise sheet."], ["Draw a flowchart: making tea", "Use the correct symbols for start, process and decision."]],
  skt: [["शब्द रूप: बालक", "Learn and write in notebook."]],
  fre: [["Les nombres 1–100", "Practise writing and saying them aloud."]],
};

/** Homework for a class over roughly the last two weeks. */
export function homeworkFor(classKey: string, grade: string, section: string): Homework[] {
  const t = today();
  const subjects = examSubjects(grade as never, section).map((s) => s.id).filter((s) => TASKS[s]);
  const out: Homework[] = [];
  for (let back = 12; back >= 0; back--) {
    const day = addDays(t, -back);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    subjects.forEach((sub, i) => {
      if (hash01("hw", classKey, isoDate(day), sub) > 0.22) return;
      const pool = TASKS[sub];
      const [title, detail] = pool[Math.floor(hash01("hwt", classKey, isoDate(day), i) * pool.length)];
      out.push({
        id: `HW-${classKey}-${isoDate(day)}-${sub}`,
        classKey,
        subject: SUBJECTS[sub].name,
        title,
        detail,
        assignedOn: day,
        dueOn: nextSchoolDay(addDays(day, 1 + Math.floor(hash01("hwd", classKey, isoDate(day), sub) * 3))),
      });
    });
  }
  for (const h of getState().homework ?? []) {
    if (h.classKey === classKey) out.push({ ...h, assignedOn: fromIso(h.assignedOn), dueOn: fromIso(h.dueOn) });
  }
  return out.sort((a, b) => b.assignedOn.getTime() - a.assignedOn.getTime());
}
