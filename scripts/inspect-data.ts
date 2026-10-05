// Prints a quick health check of the generated demo data: npx tsx scripts/inspect-data.ts
import { students, staff } from "@/lib/data/people";
import { schoolTrend, classGrid, currentSchoolDay, staffPresence, leaveRequests } from "@/lib/data/attendance";
import { ledger } from "@/lib/data/fees";
import { latestExam, toppers, classResults } from "@/lib/data/exams";
import { applications, funnel } from "@/lib/data/admissions";
import { timetable, teacherTimetable } from "@/lib/data/timetable";
import { rupeesCompact, percent } from "@/lib/format";

const t0 = Date.now();
const s = students();
console.log("students", s.length, "staff", staff().length, "ms", Date.now() - t0);
console.log("teaching staff", staff().filter(x => x.category === "Teaching").length);
const d = currentSchoolDay();
console.log("current school day", d.toDateString());
const trend = schoolTrend(10);
console.log("trend", trend.map(x => percent(x.rate)).join(" "));
const grid = classGrid(d);
console.log("grid low", grid.sort((a, b) => a.rate - b.rate).slice(0, 5).map(g => `${g.label}:${percent(g.rate)}:${g.unmarked}`).join(" "));
console.log("staff", staffPresence(), leaveRequests().map(l => `${l.staff.name}:${l.status}`).join(", "));
const t1 = Date.now();
const L = ledger();
console.log("ledger ms", Date.now() - t1, "annual", rupeesCompact(L.annualTotal), "billed", rupeesCompact(L.billed), "collected", rupeesCompact(L.collected), "overdue", rupeesCompact(L.overdue), "dueNow", rupeesCompact(L.dueNow), "defaulters", L.defaulters.length);
console.log("months", L.months.map(m => rupeesCompact(m.collected)).join(" "));
console.log("modes", Object.entries(L.modes).map(([k, v]) => `${k}:${rupeesCompact(v)}`).join(" "));
const ex = latestExam();
console.log("exam", ex.name, toppers().map(r => `${r.student.name} ${r.student.classKey} ${r.pct.toFixed(1)}`).join(" | "));
const cr = classResults("8-B");
console.log("8-B avg", cr?.avgPct.toFixed(1), cr?.distribution.map(x => `${x.grade}:${x.count}`).join(" "));
console.log("apps", applications().length, funnel().map(f => `${f.stage}:${f.count}`).join(" "));
const t2 = Date.now();
const tt = timetable();
console.log("timetable ms", Date.now() - t2, Object.keys(tt).length);
const kt = teacherTimetable("T-KAVYA");
console.log("kavya periods/week", kt.flat().filter(Boolean).length, kt[0].map(x => x ? `${x.classKey}` : "—").join(" "));
// conflicts
let conflicts = 0;
for (const st of staff()) { const g = teacherTimetable(st.id); }
const loads = staff().map(st => [st.name, teacherTimetable(st.id).flat().filter(Boolean).length] as const).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
console.log("max loads", loads.slice(0, 5), "min", loads.slice(-5));
let libs = 0; for (const g of Object.values(tt)) for (const day of g) for (const p of day) if (p?.subject === "lib" && p.teacherId === null) libs++;
console.log("filler library periods", libs, "conflicts", conflicts);
const aanya = s.find(x => x.id === "S-AANYA");
console.log("aanya", aanya?.classKey, aanya?.roll, aanya?.admissionNo);
let fill = 0; for (const g of Object.values(tt)) for (const day of g) for (const p of day) if (p && p.teacherId === null) fill++;
console.log("all filler", fill, "of", Object.keys(tt).length * 40);
console.log("top loads", staff().map(st => [st.designation, teacherTimetable(st.id).flat().filter(Boolean).length] as const).sort((a, b) => b[1] - a[1]).slice(0, 8));
