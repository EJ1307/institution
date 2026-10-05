"use client";

import { CalendarClock, Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { Legend, SERIES } from "@/components/charts/misc";
import { Crest } from "@/components/shell/Crest";
import { Select } from "@/components/ui/forms";
import { PageHeader } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardBody, CardHeader, cn, Delta } from "@/components/ui/primitives";
import { studentSummary } from "@/lib/data/attendance";
import { academicYear, schoolDaysBetween, today } from "@/lib/data/calendar";
import { upcomingEvents } from "@/lib/data/communication";
import { classResults, examsForYear, publishedExams, reportCard, type Exam, type ReportCard as RC } from "@/lib/data/exams";
import { classTeacher, staffById, PERSONA_ADMIN_ID, type Student } from "@/lib/data/people";
import { classLabelLong, GRADE_BY_ID, hasMarks } from "@/lib/data/school";
import { fmtDate, fmtWeekday, percent } from "@/lib/format";
import { hash01 } from "@/lib/rng";
import { useBrand, useChild } from "@/lib/session";
import { gradeTone } from "./shared";

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 10mm; }
  html, body { background: #fff !important; }
  #main { padding: 0 !important; max-width: none !important; }
  #main > div { animation: none !important; }
  .report-layout { display: block !important; }
  .report-sheet { border: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
  .report-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;

const pron = (s: Student) => (s.gender === "F" ? { he: "She", his: "her", him: "her" } : { he: "He", his: "his", him: "him" });

const FOCUS_TIP: Record<string, string> = {
  mat: ", especially multi-step word problems",
  hin: ", particularly written expression and matras",
  eng: ", especially longer written answers",
  sci: ", with neater labelled diagrams",
  sst: ", especially map work",
  evs: ", with more care in written answers",
  skt: ", particularly shabd roop and dhatu roop",
  fre: ", especially verb conjugations",
  cs: ", with more hands-on practice",
};

function teacherRemark(rc: RC, attRate: number) {
  const s = rc.student;
  const p = pron(s);
  // strengths relative to the class; the focus area is the lowest raw score
  const byClass = [...rc.rows].sort((a, b) => b.pct - (b.classAvg / b.max) * 100 - (a.pct - (a.classAvg / a.max) * 100));
  const sorted = [...rc.rows].sort((a, b) => b.pct - a.pct);
  const [best, second] = byClass;
  const weakest = sorted[sorted.length - 1];
  const opening =
    rc.pct >= 85
      ? `${s.firstName} is a diligent, curious learner who takes real pride in ${p.his} work.`
      : rc.pct >= 75
        ? `${s.firstName} is a sincere student who participates thoughtfully in class discussions.`
        : rc.pct >= 65
          ? `${s.firstName} is a cheerful member of the class and is learning to work more independently.`
          : `${s.firstName} is a pleasant student who needs steadier, regular effort to do justice to ${p.his} ability.`;
  const strength = `${p.his[0].toUpperCase() + p.his.slice(1)} work in ${best.subject.name} and ${second.subject.name} is particularly good.`;
  const focus =
    sorted[0].pct - weakest.pct >= 8 && weakest !== best && weakest !== second
      ? `${p.he} should give ${weakest.subject.name} more regular practice${FOCUS_TIP[weakest.subject.id] ?? ""}.`
      : `${p.he} has kept a good balance across subjects and should keep it up.`;
  const att = attRate >= 0.95 ? "Attendance has been excellent." : attRate < 0.85 ? "More regular attendance will help." : "";
  return [opening, strength, focus, att].filter(Boolean).join(" ");
}

function coScholastic(s: Student, exam: Exam) {
  const areas = ["Work education", "Art education", "Health & physical education", "Discipline"];
  return areas.map((a) => {
    const x = hash01("cosch", s.id, exam.id, a) + s.ability * 0.18;
    return { area: a, grade: x > 0.38 ? "A" : x > 0.02 ? "B" : "C" };
  });
}

export function ParentReportCard() {
  const { child } = useChild();
  if (!hasMarks(child.grade)) return <ProgressReport child={child} />;
  return <MarksReport key={child.id} child={child} />;
}

function MarksReport({ child }: { child: Student }) {
  const brand = useBrand();
  const toast = useToast();
  const exams = publishedExams();
  const [examId, setExamId] = useState(exams[exams.length - 1].id);
  const exam = exams.find((e) => e.id === examId) ?? exams[exams.length - 1];
  const rc = reportCard(child, exam)!;
  const prevExam = exams[exams.findIndex((e) => e.id === exam.id) - 1];
  const prev = prevExam ? reportCard(child, prevExam) : null;
  const t = today();
  const ay = academicYear(t);
  const teacher = classTeacher(child.classKey);
  const principal = staffById(PERSONA_ADMIN_ID);
  const att = useMemo(() => studentSummary(child, schoolDaysBetween(ay.start, exam.end < t ? exam.end : t)), [child, exam, ay.start]);
  const remark = teacherRemark(rc, att.rate);
  const co = coScholastic(child, exam);
  const father = child.guardians.find((g) => g.relation === "Father");
  const mother = child.guardians.find((g) => g.relation === "Mother");
  const ptm = Number(child.grade) >= 6 && Number(child.grade) <= 10 ? upcomingEvents(12).find((e) => /PTM/.test(e.title)) : undefined;

  const progress = useMemo(() => {
    const list = [...examsForYear(ay.startYear - 1), ...exams];
    return list.map((e) => {
      const r = reportCard(child, e);
      const cr = classResults(child.classKey, e);
      const yr = e.start.getFullYear() - (e.start.getMonth() < 3 ? 1 : 0);
      return { e, label: yr === ay.startYear ? e.short : `${e.short} ’${String(yr).slice(2)}`, tick: e.id.startsWith("AN") ? "Annual" : e.id.split("-")[0], pct: r?.pct ?? null, avg: cr?.avgPct ?? null };
    });
  }, [child, ay.startYear, exams.length]);

  const vsClass = (r: RC["rows"][number]) => r.pct - (r.classAvg / r.max) * 100;
  const sorted = [...rc.rows].sort((a, b) => vsClass(b) - vsClass(a));

  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader
        className="no-print"
        eyebrow={`${child.name} · ${classLabelLong(child.grade, child.section)}`}
        title="Report card"
        description={`${exam.name} · results declared ${fmtDate(exam.resultsOn)}. Signed copies are handed over at the parent–teacher meeting.`}
        actions={
          <>
            <Select value={exam.id} onChange={(e) => setExamId(e.target.value)} aria-label="Exam">
              {[...exams].reverse().map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" onClick={() => window.print()}>
              <Download /> Download PDF
            </Button>
          </>
        }
      />

      <div className="report-layout grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="no-print xl:hidden">
          <ResultSummary rc={rc} prev={prev} prevShort={prevExam?.short} examShort={exam.short} />
        </div>

        {/* ——— The printable report card ——— */}
        <article id="report-card" className="report-sheet overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
          <header className="flex flex-col gap-4 px-5 pt-6 pb-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-center gap-4">
              <Crest size={56} />
              <div className="min-w-0">
                <p className="title-serif text-[20px] leading-tight font-semibold text-ink sm:text-[22px]">{brand.school}</p>
                <p className="mt-0.5 text-[12px] text-muted">{brand.city}, Haryana · Affiliated to CBSE, New Delhi · Affiliation No. 531204</p>
                <p className="mt-0.5 text-[12px] text-ink-2">
                  {brand.motto} <span className="text-muted">· {brand.mottoTranslation}</span>
                </p>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="eyebrow">Report card</p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{exam.name}</p>
              <p className="text-[12px] text-muted">Academic year {ay.label}</p>
            </div>
          </header>
          <div className="mx-5 border-t-2 border-double border-line-strong sm:mx-8" style={{ borderTopWidth: 3 }} />

          {/* Student details */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-5 text-[13px] sm:grid-cols-4 sm:px-8">
            {[
              { k: "Student", v: child.name },
              { k: "Class & section", v: classLabelLong(child.grade, child.section) },
              { k: "Roll no.", v: String(child.roll) },
              { k: "Admission no.", v: child.admissionNo },
              { k: "Date of birth", v: fmtDate(new Date(child.dob)) },
              { k: "House", v: child.house },
              { k: "Father", v: father?.name ?? "—" },
              { k: "Mother", v: mother?.name ?? "—" },
            ].map((x) => (
              <div key={x.k} className="min-w-0">
                <dt className="text-[11px] font-medium tracking-[0.04em] text-muted uppercase">{x.k}</dt>
                <dd className="mt-0.5 truncate font-medium text-ink">{x.v}</dd>
              </div>
            ))}
          </dl>

          {/* Scholastic */}
          <section className="px-5 sm:px-8">
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Scholastic areas</h3>
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-surface-2 text-[11.5px] font-semibold text-muted">
                  <tr>
                    <th className="px-3 py-2 sm:px-4">Subject</th>
                    <th className="px-2 py-2 text-right">Marks</th>
                    <th className="px-2 py-2 text-center">Grade</th>
                    <th className="px-2 py-2 text-right">Class avg</th>
                    <th className="hidden px-3 py-2 text-right sm:table-cell sm:px-4">Highest</th>
                  </tr>
                </thead>
                <tbody>
                  {rc.rows.map((r) => (
                    <tr key={r.subject.id} className="border-t border-line">
                      <td className="px-3 py-2.5 font-medium text-ink sm:px-4">{r.subject.name}</td>
                      <td className="tnum px-2 py-2.5 text-right">
                        <span className="font-semibold text-ink">{r.marks}</span>
                        <span className="text-muted">/{r.max}</span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <Badge tone={gradeTone(r.grade)}>{r.grade}</Badge>
                      </td>
                      <td className="tnum px-2 py-2.5 text-right text-ink-2">{r.classAvg.toFixed(1)}</td>
                      <td className="tnum hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell sm:px-4">{r.highest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl className="grid grid-cols-2 gap-px border-t border-line-strong bg-line sm:grid-cols-4">
                {[
                  { k: "Total", v: `${rc.total} / ${rc.max}` },
                  { k: "Percentage", v: `${rc.pct.toFixed(1)}%` },
                  { k: "Overall grade", v: rc.grade },
                  { k: "Rank in class", v: `${ordinal(rc.rank)} of ${rc.classSize}` },
                ].map((x) => (
                  <div key={x.k} className="bg-surface-2 px-3 py-2.5 sm:px-4">
                    <dt className="text-[11px] text-muted">{x.k}</dt>
                    <dd className="tnum text-[15px] font-semibold text-ink">{x.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* Co-scholastic + attendance */}
          <section className="grid grid-cols-1 gap-5 px-5 pt-6 sm:grid-cols-[minmax(0,1fr)_220px] sm:px-8">
            <div>
              <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Co-scholastic areas · 3-point scale</h3>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {co.map((c) => (
                  <li key={c.area} className="flex items-center justify-between px-3 py-2 text-[13px] sm:px-4">
                    <span className="text-ink-2">{c.area}</span>
                    <span className="tnum w-6 text-center font-semibold text-ink">{c.grade}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Attendance</h3>
              <div className="rounded-lg border border-line px-4 py-3">
                <p className="tnum text-[22px] leading-none font-semibold text-ink">{percent(att.rate)}</p>
                <p className="mt-1.5 text-[12.5px] text-muted">
                  {att.present + att.late} of {att.total - att.unmarked} school days
                  <br />1 April – {fmtDate(exam.end < t ? exam.end : t)}
                </p>
              </div>
            </div>
          </section>

          {/* Remark */}
          <section className="px-5 pt-6 sm:px-8">
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Class teacher&rsquo;s remark</h3>
            <blockquote className="title-serif rounded-lg border-l-[3px] border-accent bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-ink italic">{remark}</blockquote>
          </section>

          {/* Signatures */}
          <section className="grid grid-cols-3 gap-4 px-5 pt-10 pb-4 text-center sm:px-8">
            {[
              { k: "Class teacher", v: teacher ? `${teacher.title} ${teacher.name}` : "" },
              { k: "Principal", v: principal ? `${principal.title} ${principal.name}` : "" },
              { k: "Parent", v: "" },
            ].map((x) => (
              <div key={x.k}>
                <p className="title-serif h-6 truncate text-[14px] text-ink-2 italic">{x.v && x.k !== "Parent" ? x.v.replace(/^(Ms\.|Mr\.|Mrs\.|Dr\.)\s*/, "") : ""}</p>
                <div className="mt-1 border-t border-line-strong pt-1.5">
                  <p className="text-[11.5px] font-medium text-ink-2">{x.k}</p>
                  {x.v && <p className="truncate text-[11px] text-muted">{x.v}</p>}
                </div>
              </div>
            ))}
          </section>
          <footer className="flex flex-col gap-1 border-t border-line bg-surface-2 px-5 py-3 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>Grades: A1 91–100 · A2 81–90 · B1 71–80 · B2 61–70 · C1 51–60 · C2 41–50 · D 33–40 · E below 33</span>
            <span className="shrink-0">Issued {fmtDate(exam.resultsOn)}</span>
          </footer>
        </article>

        {/* ——— Side panel ——— */}
        <div className="no-print flex flex-col gap-4">
          <div className="hidden xl:block">
            <ResultSummary rc={rc} prev={prev} prevShort={prevExam?.short} examShort={exam.short} />
          </div>

          <Card>
            <CardHeader title="Progress across exams" description="Overall percentage, last year and this year" />
            <CardBody>
              <Legend
                kind="line"
                className="mb-3"
                items={[
                  { label: child.firstName, color: SERIES.s1 },
                  { label: "Class average", color: "var(--faint)" },
                ]}
              />
              <LineChart
                ariaLabel={`${child.firstName}'s overall percentage across exams compared with the class average`}
                labels={progress.map((p) => p.label)}
                tickLabel={(i) => progress[i].tick}
                series={[
                  { id: "avg", label: "Class average", color: "var(--faint)", values: progress.map((p) => p.avg), dashed: true },
                  { id: "me", label: child.firstName, color: SERIES.s1, values: progress.map((p) => p.pct) },
                ]}
                yFormat={(n) => `${n}%`}
                valueFormat={(n) => `${n.toFixed(1)}%`}
                height={180}
              />
              <div className="mt-2 flex justify-between text-[11px] text-faint">
                <span>{`AY ${academicYear(new Date(ay.startYear - 1, 5, 1)).label}`}</span>
                <span>{`AY ${ay.label}`}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Compared with the class" description="Subject marks minus the class average" />
            <ul className="border-t border-line px-5 py-1">
              {sorted.map((r) => {
                const diff = vsClass(r);
                return (
                  <li key={r.subject.id} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[13px] first:border-t-0">
                    <span className="text-ink-2">{r.subject.name}</span>
                    <Delta value={diff} format={(n) => `${n.toFixed(1)} pts`} />
                  </li>
                );
              })}
            </ul>
          </Card>

          {ptm && (
            <Card className="flex items-start gap-3 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                <CalendarClock className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-ink">Parent–teacher meeting · {fmtWeekday(ptm.date)}</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  Your slot: 9:40 am with {teacher ? `${teacher.title} ${teacher.lastName}` : "the class teacher"}. Discuss this report card in person.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2.5"
                  onClick={() => toast({ title: "Slot change requested", body: "You'll be offered the next free slot by tomorrow evening.", tone: "info" })}
                >
                  Change slot
                </Button>
              </div>
            </Card>
          )}

          <p className="flex items-center gap-2 px-1 text-[12px] text-muted">
            <Printer className="size-3.5" /> Download PDF opens the print dialog — choose &ldquo;Save as PDF&rdquo;.
          </p>
        </div>
      </div>
    </>
  );
}

function ResultSummary({ rc, prev, prevShort, examShort }: { rc: RC; prev: RC | null; prevShort?: string; examShort: string }) {
  return (
    <Card className="p-5">
      <p className="text-[12.5px] font-medium text-muted">{examShort} result</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="tnum text-[34px] leading-none font-semibold tracking-[-0.02em]">{rc.pct.toFixed(1)}%</span>
        <Badge tone={gradeTone(rc.grade)} className="h-6 px-2.5 text-[12.5px]">
          Grade {rc.grade}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
        {prev && <Delta value={rc.pct - prev.pct} format={(n) => `${n.toFixed(1)} pts`} suffix={`vs ${prevShort}`} />}
        <span>
          {ordinal(rc.rank)} of {rc.classSize} in class
        </span>
      </div>
    </Card>
  );
}

// ——— Pre-primary: developmental progress report —————————————————————————

const DOMAINS = [
  { id: "lang", name: "Language & communication", points: ["Listens to and retells short stories", "Recognises letters and their sounds", "Speaks in full sentences"] },
  { id: "num", name: "Early numeracy", points: ["Counts objects to 20", "Recognises shapes and patterns", "Compares bigger / smaller, more / less"] },
  { id: "phys", name: "Physical development", points: ["Holds a pencil with a tripod grip", "Balances, hops and climbs with confidence"] },
  { id: "soc", name: "Personal, social & emotional", points: ["Takes turns and shares", "Follows class routines independently"] },
  { id: "art", name: "Creative expression", points: ["Enjoys rhymes, music and movement", "Uses colours and materials imaginatively"] },
];

const LEVELS = ["Beginning", "Developing", "Secure"] as const;

function ProgressReport({ child }: { child: Student }) {
  const brand = useBrand();
  const t = today();
  const ay = academicYear(t);
  const teacher = classTeacher(child.classKey);
  const term = t.getMonth() >= 9 || t.getMonth() < 3 ? "Term 1 (April – September)" : "Term 1, mid-term";
  const p = pron(child);
  return (
    <>
      <style>{PRINT_CSS}</style>
      <PageHeader
        className="no-print"
        eyebrow={`${child.name} · ${GRADE_BY_ID[child.grade].label} ${child.section}`}
        title="Progress report"
        description="Early years are assessed through observation, not marks. Here is how your child is growing in each area."
        actions={
          <Button variant="primary" onClick={() => window.print()}>
            <Download /> Download PDF
          </Button>
        }
      />
      <article className="report-sheet mx-auto max-w-[860px] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]">
        <header className="flex items-center gap-4 px-5 pt-6 pb-5 sm:px-8">
          <Crest size={52} />
          <div className="min-w-0 flex-1">
            <p className="title-serif text-[20px] leading-tight font-semibold">{brand.school}</p>
            <p className="text-[12px] text-muted">
              Pre-primary progress report · {term} · AY {ay.label}
            </p>
          </div>
        </header>
        <div className="mx-5 border-t-[3px] border-double border-line-strong sm:mx-8" />
        <div className="grid grid-cols-1 gap-4 px-5 py-6 sm:grid-cols-2 sm:px-8">
          {DOMAINS.map((d) => (
            <section key={d.id} className="rounded-xl border border-line p-4">
              <h3 className="text-[13.5px] font-semibold text-ink">{d.name}</h3>
              <ul className="mt-3 flex flex-col gap-2.5">
                {d.points.map((pt) => {
                  const lvl = Math.min(2, Math.floor(hash01("pp", child.id, pt) * 2.2 + 0.6 + child.ability * 0.3));
                  return (
                    <li key={pt} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="text-ink-2">{pt}</span>
                      <span className="flex shrink-0 gap-1" aria-label={LEVELS[Math.max(0, lvl)]}>
                        {LEVELS.map((l, i) => (
                          <span key={l} title={l} className={cn("h-1.5 w-5 rounded-full", i <= lvl ? "bg-brand" : "bg-ink/[0.08]")} />
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <section className="rounded-xl border border-line bg-surface-2 p-4">
            <h3 className="text-[13.5px] font-semibold text-ink">Scale</h3>
            <ul className="mt-3 flex flex-col gap-2 text-[12.5px] text-ink-2">
              {LEVELS.map((l, i) => (
                <li key={l} className="flex items-center gap-2">
                  <span className="flex gap-1">
                    {LEVELS.map((_, j) => (
                      <span key={j} className={cn("h-1.5 w-4 rounded-full", j <= i ? "bg-brand" : "bg-ink/[0.08]")} />
                    ))}
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <section className="px-5 pb-6 sm:px-8">
          <h3 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Teacher&rsquo;s note</h3>
          <blockquote className="title-serif rounded-lg border-l-[3px] border-accent bg-surface-2 px-4 py-3 text-[15px] leading-relaxed italic">
            {child.firstName} has settled happily into the class routine and loves story time. {p.he} is growing in confidence when speaking to the group, and we will keep
            building {p.his} fine-motor control with clay and threading work at home and school.
          </blockquote>
          <p className="mt-3 text-right text-[12px] text-muted">{teacher ? `${teacher.title} ${teacher.name}, class teacher` : ""}</p>
        </section>
      </article>
    </>
  );
}
