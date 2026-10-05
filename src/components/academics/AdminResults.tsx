"use client";

import { CalendarClock, Check, Download, FileCheck2, Send, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { Heatmap } from "@/components/charts/Heatmap";
import { Legend, SERIES } from "@/components/charts/misc";
import { Checkbox, SearchInput, Select } from "@/components/ui/forms";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, Card, CardBody, CardHeader, cn, Delta, Meter } from "@/components/ui/primitives";
import { SortTh, Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { academicYear, today } from "@/lib/data/calendar";
import { CBSE_GRADES, classResults, gradeFor, publishedExams, toppers, upcomingExam, type Exam } from "@/lib/data/exams";
import { classTeacher } from "@/lib/data/people";
import { classLabel, classLabelLong, CLASSES, examSubjects, GRADES } from "@/lib/data/school";
import { fmtDate, fmtDay, number, percent, plural } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";
import { gradeLabel, gradeSubjectAvg, gradeTone, MARKED_CLASSES, passedAll, RESULT_BINS, resultTone } from "./shared";

type SortKey = "rank" | "name" | "pct";

function schoolStats(exam: Exam) {
  const rs = MARKED_CLASSES.map((c) => classResults(c.key, exam)!).filter(Boolean);
  const all = rs.flatMap((r) => r.table);
  const n = all.length || 1;
  return {
    students: all.length,
    avg: all.reduce((a, t) => a + t.pct, 0) / n,
    pass: all.filter((t) => passedAll(t.marks, exam.max)).length / n,
    failed: all.filter((t) => !passedAll(t.marks, exam.max)).length,
    a1: all.filter((t) => t.pct >= 91).length,
    support: all.filter((t) => t.pct < 50).length,
  };
}

export function AdminResults() {
  const toast = useToast();
  const published = useAppState((s) => s.reportCardsPublished);
  const gradebook = useAppState((s) => s.gradebook);
  const exams = publishedExams();
  const [examId, setExamId] = useState(exams[exams.length - 1].id);
  const exam = exams.find((e) => e.id === examId) ?? exams[exams.length - 1];
  const prevExam = exams[exams.findIndex((e) => e.id === exam.id) - 1];
  const [classKey, setClassKey] = useState("8-B");
  const [publishOpen, setPublishOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const classRef = useRef<HTMLDivElement>(null);
  const ay = academicYear(today());

  const stats = useMemo(() => schoolStats(exam), [exam]);
  const prevStats = useMemo(() => (prevExam ? schoolStats(prevExam) : null), [prevExam]);
  const tops = useMemo(() => toppers(["10", "12"], exam, 5), [exam]);
  const next = upcomingExam();

  const pubAt = published[exam.id] ?? (exam.resultsOn.getTime() + 5 * 86400000 < today().getTime() ? new Date(exam.resultsOn.getTime() + 2 * 86400000).toISOString() : null);

  // marks entry progress for the next exam (teachers' gradebooks)
  const entry = useMemo(() => {
    if (!next) return null;
    const sheets = MARKED_CLASSES.reduce((a, c) => a + examSubjects(c.grade, c.section).length, 0);
    const submitted = Object.entries(gradebook).filter(([k, v]) => k.startsWith(`${next.id}|`) && v.submittedAt).length;
    const started = Object.entries(gradebook).filter(([k, v]) => k.startsWith(`${next.id}|`) && !v.submittedAt && Object.keys(v.marks).length > 0).length;
    return { sheets, submitted, started };
  }, [gradebook, next]);

  const selectClass = (key: string) => {
    setClassKey(key);
    requestAnimationFrame(() => classRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <PageHeader
        eyebrow={`AY ${ay.label} · Results declared ${fmtDate(exam.resultsOn)}`}
        title="Exams & results"
        description={`${exam.name} · ${number(stats.students)} students in Classes I–XII · each subject marked out of ${exam.max}.`}
        actions={
          <>
            <Select value={exam.id} onChange={(e) => setExamId(e.target.value)} aria-label="Exam">
              {[...exams].reverse().map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              onClick={() => toast({ title: "Marksheet is being prepared", body: `${exam.name}: one sheet per class, subject-wise marks and grades (.xlsx).`, tone: "info" })}
            >
              <Download /> Download marksheet
            </Button>
            {pubAt ? (
              <Button
                variant="secondary"
                onClick={() => toast({ title: "Report cards are already with parents", body: `Published ${fmtDay(new Date(pubAt))}. Parents can download them from the app.`, tone: "info" })}
              >
                <Check className="text-good" /> Published {fmtDay(new Date(pubAt))}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setPublishOpen(true)}>
                <FileCheck2 /> Publish report cards
              </Button>
            )}
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="School average"
          value={percent(stats.avg / 100)}
          delta={prevStats && <Delta value={stats.avg - prevStats.avg} format={(n) => `${n.toFixed(1)} pts`} suffix={`vs ${prevExam!.short}`} />}
        />
        <Stat
          label="Passed every subject"
          value={percent(stats.pass)}
          sub={stats.failed ? `${plural(stats.failed, "student")} below 33% in a subject` : "No student below 33% in any subject"}
        />
        <Stat
          label="A1 overall (91%+)"
          value={number(stats.a1)}
          delta={prevStats && <Delta value={stats.a1 - prevStats.a1} format={(n) => `${n}`} suffix={`vs ${prevExam!.short}`} />}
          sub={`${percent(stats.a1 / stats.students)} of students`}
        />
        <Stat label="Below 50% overall" value={number(stats.support)} sub="Offered remedial classes after school, Tue & Thu" />
      </div>

      {/* Section averages + upcoming + toppers */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Class averages"
            description="Average percentage across subjects, by section. Select a class for its full results."
            action={<Legend items={RESULT_BINS.map((b) => ({ label: b.label, color: b.bg }))} className="hidden md:flex" />}
          />
          <CardBody>
            <Heatmap
              columns={["A", "B", "C", "D"]}
              rows={GRADES.filter((g) => !Number.isNaN(Number(g.id))).map((g) => {
                const sec = g.sections.map((s) => classResults(`${g.id}-${s}`, exam)!);
                const gAvg = sec.reduce((a, r) => a + r.avgPct, 0) / sec.length;
                return {
                  label: g.short,
                  cells: ["A", "B", "C", "D"].map((s) => {
                    if (!g.sections.includes(s)) return null;
                    const r = classResults(`${g.id}-${s}`, exam)!;
                    return {
                      key: `${g.id}-${s}`,
                      value: r.avgPct,
                      display: `${r.avgPct.toFixed(1)}%`,
                      detail: (
                        <div>
                          <div className="text-[11px] text-white/60">
                            {classLabel(g.id, s)} · {classTeacher(`${g.id}-${s}`)?.name ?? "—"}
                          </div>
                          <div>
                            <span className="font-semibold">{r.avgPct.toFixed(1)}%</span> average · {g.label} {gAvg.toFixed(1)}%
                          </div>
                        </div>
                      ),
                    };
                  }),
                };
              })}
              tone={resultTone}
              onCell={selectClass}
            />
            <Legend items={RESULT_BINS.map((b) => ({ label: b.label, color: b.bg }))} className="mt-4 md:hidden" />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          {next && (
            <Card>
              <CardHeader title="Next exam" icon={<CalendarClock />} />
              <CardBody className="pt-0">
                <div className="flex items-start gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-brand-soft py-1.5 text-brand">
                    <span className="text-[10px] font-semibold uppercase">{fmtDay(next.start).split(" ")[1]}</span>
                    <span className="tnum text-[18px] leading-tight font-semibold">{next.start.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">{next.name}</p>
                    <p className="text-[12.5px] text-muted">
                      {fmtDay(next.start)} – {fmtDay(next.end)} · in {Math.round((next.start.getTime() - today().getTime()) / 86400000)} days · {next.max} marks per subject
                    </p>
                  </div>
                </div>
                {entry && (
                  <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3.5">
                    <div className="flex items-baseline justify-between text-[12.5px]">
                      <span className="text-ink-2">Marks submitted by teachers</span>
                      <span className="tnum font-semibold text-ink">
                        {entry.submitted}/{entry.sheets}
                      </span>
                    </div>
                    <Meter value={entry.submitted / entry.sheets} className="mt-2" label="Mark sheets submitted" />
                    <p className="mt-2 text-[12px] text-muted">
                      {entry.started ? `${plural(entry.started, "sheet")} in progress · ` : ""}Results due {fmtDate(next.resultsOn)}
                    </p>
                  </div>
                )}
                <Button
                  className="mt-3 w-full"
                  variant="secondary"
                  onClick={() => toast({ title: "Date sheet shared", body: `${next.name} date sheet and syllabus sent to all parents of Classes I–XII.` })}
                >
                  <Send /> Share date sheet with parents
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Toppers" icon={<Trophy />} description={`${exam.short} · Classes X & XII`} />
            <ol className="px-5 pb-4">
              {tops.map((r, i) => (
                <li key={r.student.id}>
                  <Link href={`/students/${r.student.id}`} className="-mx-2 flex items-center gap-3 rounded-lg border-t border-line px-2 py-2.5 hover:bg-surface-2">
                    <span className="tnum w-4 text-[12px] font-semibold text-muted">{i + 1}</span>
                    <Avatar name={r.student.name} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{r.student.name}</span>
                      <span className="block text-[12px] text-muted">{classLabelLong(r.student.grade, r.student.section)}</span>
                    </span>
                    <span className="tnum text-[13px] font-semibold">{r.pct.toFixed(1)}%</span>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {/* Class drill-down */}
      <div ref={classRef} className="scroll-mt-24">
        <ClassSection classKey={classKey} setClassKey={setClassKey} exam={exam} prevExam={prevExam} />
      </div>

      <Dialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={`Publish ${exam.short} report cards`}
        description={`${number(stats.students)} report cards, signed by you and the class teachers, will appear in the parent app.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setState((st) => ({ reportCardsPublished: { ...st.reportCardsPublished, [exam.id]: new Date().toISOString() } }));
                setPublishOpen(false);
                toast({
                  title: `${exam.short} report cards published`,
                  body: notify ? `${number(stats.students)} families will get an SMS and app notification within the next few minutes.` : "Parents will see them the next time they open the app.",
                });
              }}
            >
              <FileCheck2 /> Publish now
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
            {[
              { k: "Classes", v: MARKED_CLASSES.length },
              { k: "Students", v: number(stats.students) },
              { k: "Remarks written", v: "100%" },
            ].map((x) => (
              <div key={x.k} className="bg-surface px-3 py-3">
                <dt className="text-[12px] text-muted">{x.k}</dt>
                <dd className="tnum mt-0.5 text-[17px] font-semibold">{x.v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[12.5px] text-muted">Classes I–XII only. Nursery to UKG receive a separate developmental progress report from the pre-primary coordinator.</p>
          <Checkbox checked={notify} onChange={setNotify} label="Send parents an SMS and app notification" />
        </div>
      </Dialog>
    </>
  );
}

// ——— One class ———————————————————————————————————————————————————

function ClassSection({ classKey, setClassKey, exam, prevExam }: { classKey: string; setClassKey: (k: string) => void; exam: Exam; prevExam?: Exam }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "rank", dir: "asc" });
  const [q, setQ] = useState("");
  const ref = CLASSES.find((c) => c.key === classKey)!;
  const res = classResults(classKey, exam)!;
  const prev = prevExam ? classResults(classKey, prevExam) : null;
  const teacher = classTeacher(classKey);
  const label = classLabel(ref.grade, ref.section);

  const subjectRows = useMemo(
    () =>
      res.subjectStats.map((st, i) => ({
        ...st,
        gradeAvg: gradeSubjectAvg(ref.grade, st.subject.id, exam) ?? st.avgPct,
        failing: res.table.filter((t) => t.marks[i] / exam.max < 0.33).length,
      })),
    [res, ref.grade, exam],
  );
  const mostCommon = res.distribution.reduce((a, b) => (b.count > a.count ? b : a));

  const rows = res.table
    .map((t) => ({ ...t, rank: res.rankOf.get(t.student.id)!, prevPct: prev?.table.find((p) => p.student.id === t.student.id)?.pct ?? null }))
    .filter((t) => (q ? `${t.student.name} ${t.student.roll}`.toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => {
      const d = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "name") return a.student.name.localeCompare(b.student.name) * d;
      if (sort.key === "pct") return (a.pct - b.pct) * d;
      return (a.rank - b.rank) * d;
    });
  const onSort = (k: SortKey) => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === "asc" ? "desc" : "asc") : k === "pct" ? "desc" : "asc" }));

  return (
    <>
      <div className="mt-8 mb-4 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1">Class results</p>
          <h2 className="title-serif text-[22px] leading-tight font-semibold">{classLabelLong(ref.grade, ref.section)}</h2>
          <p className="mt-1 text-[13px] text-muted">
            {exam.name} · class teacher {teacher ? `${teacher.title} ${teacher.name}` : "—"} · {res.table.length} students · average{" "}
            <span className="tnum font-medium text-ink">{res.avgPct.toFixed(1)}%</span>
            {prev && (
              <>
                {" "}
                <Delta value={res.avgPct - prev.avgPct} format={(n) => `${n.toFixed(1)} pts`} suffix={`vs ${prevExam!.short}`} />
              </>
            )}
          </p>
        </div>
        <Select value={classKey} onChange={(e) => setClassKey(e.target.value)} aria-label="Class">
          {MARKED_CLASSES.map((c) => (
            <option key={c.key} value={c.key}>
              {classLabelLong(c.grade, c.section)}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Subject analysis" description={`${label} average against all ${ref.grade === "11" || ref.grade === "12" ? "streams" : "sections"} of ${gradeLabel(ref.grade)}`} />
          <CardBody>
            <Legend
              className="mb-3"
              items={[
                { label: label, color: SERIES.s1 },
                { label: `${gradeLabel(ref.grade)}, all sections`, color: SERIES.muted },
              ]}
            />
            <ColumnChart
              ariaLabel={`Subject averages for ${label} compared with the whole grade`}
              categories={subjectRows.map((s) => s.subject.short)}
              series={[
                { id: "class", label, color: SERIES.s1, values: subjectRows.map((s) => s.avgPct) },
                { id: "grade", label: "All sections", color: SERIES.muted, values: subjectRows.map((s) => s.gradeAvg) },
              ]}
              yFormat={(n) => `${n}%`}
              valueFormat={(n) => `${n.toFixed(1)}%`}
              height={220}
            />
          </CardBody>
          <Table>
            <THead>
              <tr>
                <Th>Subject</Th>
                <Th align="right">Class avg</Th>
                <Th align="right">vs grade</Th>
                <Th align="right">Highest</Th>
                <Th align="right">Lowest</Th>
                <Th align="right">Below 33%</Th>
              </tr>
            </THead>
            <tbody>
              {subjectRows.map((s) => (
                <Tr key={s.subject.id}>
                  <Td className="h-10 font-medium">{s.subject.name}</Td>
                  <Td align="right" className="h-10 font-semibold">
                    {s.avgPct.toFixed(1)}%
                  </Td>
                  <Td align="right" className="h-10">
                    <Delta value={s.avgPct - s.gradeAvg} format={(n) => n.toFixed(1)} />
                  </Td>
                  <Td align="right" className="h-10">
                    {s.highest}/{exam.max}
                  </Td>
                  <Td align="right" className="h-10">
                    {s.lowest}/{exam.max}
                  </Td>
                  <Td align="right" className={cn("h-10", s.failing ? "font-semibold text-bad" : "text-muted")}>
                    {s.failing}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Grade distribution" description={`${label} · overall CBSE grade`} />
          <CardBody>
            <ColumnChart
              ariaLabel={`Number of students in ${label} at each CBSE grade`}
              categories={CBSE_GRADES.map((g) => g.grade)}
              series={[{ id: "n", label: "Students", color: SERIES.s1, values: res.distribution.map((d) => d.count) }]}
              yFormat={(n) => String(n)}
              valueFormat={(n) => plural(n, "student")}
              highlight={CBSE_GRADES.findIndex((g) => g.grade === mostCommon.grade)}
              height={200}
            />
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
                { k: "A1 & A2", v: res.distribution.filter((d) => d.grade.startsWith("A")).reduce((a, d) => a + d.count, 0) },
                { k: "C2 and below", v: res.distribution.filter((d) => ["C2", "D", "E"].includes(d.grade)).reduce((a, d) => a + d.count, 0) },
              ].map((x) => (
                <div key={x.k} className="bg-surface px-3.5 py-2.5">
                  <dt className="text-[12px] text-muted">{x.k}</dt>
                  <dd className="tnum text-[17px] font-semibold">{x.v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">CBSE grades: A1 91–100 · A2 81–90 · B1 71–80 · B2 61–70 · C1 51–60 · C2 41–50 · D 33–40 · E below 33.</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[14px] font-semibold">Full results · {label}</h2>
            <p className="text-[12.5px] text-muted">Marks out of {exam.max} per subject; ranks by total. Marks below 33% are in red.</p>
          </div>
          <SearchInput value={q} onChange={setQ} placeholder="Search name or roll no." className="sm:w-[240px]" />
        </div>
        <Table>
          <THead>
            <tr>
              <SortTh label="Rank" k="rank" sort={sort} onSort={onSort} className="w-16" />
              <SortTh label="Student" k="name" sort={sort} onSort={onSort} />
              {res.subjects.map((s) => (
                <Th key={s.id} align="right" title={s.name}>
                  {s.short}
                </Th>
              ))}
              <Th align="right">Total</Th>
              <SortTh label="%" k="pct" sort={sort} onSort={onSort} align="right" />
              <Th align="center">Grade</Th>
              {prev && <Th align="right">vs {prevExam!.short}</Th>}
            </tr>
          </THead>
          <tbody>
            {rows.map((t) => (
              <Tr key={t.student.id}>
                <Td>
                  <span className={cn("tnum inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[12px] font-semibold", t.rank <= 3 ? "bg-brand-soft text-brand" : "text-muted")}>{t.rank}</span>
                </Td>
                <Td>
                  <Link href={`/students/${t.student.id}`} className="flex items-center gap-2.5 hover:underline">
                    <Avatar name={t.student.name} size={26} />
                    <span className="font-medium whitespace-nowrap">{t.student.name}</span>
                  </Link>
                </Td>
                {t.marks.map((m, i) => (
                  <Td key={i} align="right" className={cn(m / exam.max < 0.33 ? "font-semibold text-bad" : "text-ink-2")}>
                    {m}
                  </Td>
                ))}
                <Td align="right" className="font-medium">
                  {t.total}
                </Td>
                <Td align="right" className="font-semibold">
                  {t.pct.toFixed(1)}
                </Td>
                <Td align="center">
                  <Badge tone={gradeTone(gradeFor(t.pct))}>{gradeFor(t.pct)}</Badge>
                </Td>
                {prev && (
                  <Td align="right">
                    {t.prevPct !== null ? <Delta value={t.pct - t.prevPct} format={(n) => n.toFixed(1)} /> : <span className="text-muted">—</span>}
                  </Td>
                )}
              </Tr>
            ))}
          </tbody>
        </Table>
        {rows.length === 0 && <EmptyState title={`No student matches “${q}”`} body="Try a first name or a roll number." />}
      </Card>
    </>
  );
}
