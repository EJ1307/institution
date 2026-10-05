"use client";

import { Lock, LockOpen, Send } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { SERIES } from "@/components/charts/misc";
import { Segmented } from "@/components/ui/forms";
import { PageHeader, Stat } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, Card, CardBody, CardHeader, cn, Delta, Meter } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { academicYear, today } from "@/lib/data/calendar";
import { CBSE_GRADES, classResults, examsForYear, gradeFor, type Exam } from "@/lib/data/exams";
import { studentsInClass, type Student } from "@/lib/data/people";
import { classLabel, CLASSES } from "@/lib/data/school";
import { subjectName, teacherTimetable } from "@/lib/data/timetable";
import { fmtDate, fmtDay, plural } from "@/lib/format";
import { useTeacher } from "@/lib/session";
import { setState, useAppState } from "@/lib/store";
import { gradeLabel, gradeSubjectAvg, gradeTone } from "./shared";

type Row = { s: Student; mark: number | "AB" | null; prevPct: number | null };

export function TeacherGradebook() {
  const teacher = useTeacher();
  const toast = useToast();
  const gradebook = useAppState((s) => s.gradebook);
  const subjectId = teacher.subjects[0] ?? "mat";
  const t0 = today();
  const ay = academicYear(t0);

  const myClasses = useMemo(() => {
    const keys = new Set<string>();
    teacherTimetable(teacher.id).forEach((d) => d.forEach((slot) => slot && slot.subject === subjectId && keys.add(slot.classKey)));
    return CLASSES.filter((c) => keys.has(c.key));
  }, [teacher.id, subjectId]);

  const exams = useMemo(() => {
    const all = examsForYear(ay.startYear);
    const done = all.filter((e) => e.resultsOn <= t0);
    const nextOpen = all.find((e) => e.resultsOn > t0);
    return nextOpen ? [...done, nextOpen] : done;
  }, [ay.startYear]);

  const [classKey, setClassKey] = useState(myClasses.some((c) => c.key === teacher.classTeacherOf) ? teacher.classTeacherOf! : myClasses[0]?.key);
  const publishedList = exams.filter((e) => e.resultsOn <= t0);
  const [examId, setExamId] = useState(publishedList[publishedList.length - 1]?.id ?? exams[0].id);
  const exam = exams.find((e) => e.id === examId)!;
  const isOpen = exam.resultsOn > t0;
  const prevExam = exams[exams.findIndex((e) => e.id === exam.id) - 1];
  const ref = CLASSES.find((c) => c.key === classKey)!;
  const label = classLabel(ref.grade, ref.section);
  const sheetKey = `${exam.id}|${classKey}|${subjectId}`;
  const sheet = gradebook[sheetKey];

  const rows: Row[] = useMemo(() => {
    const prevRes = prevExam ? classResults(classKey, prevExam) : null;
    const pIdx = prevRes?.subjects.findIndex((s) => s.id === subjectId) ?? -1;
    const prevPctOf = (id: string) => {
      if (!prevRes || pIdx < 0) return null;
      const r = prevRes.table.find((t) => t.student.id === id);
      return r ? (r.marks[pIdx] / prevExam!.max) * 100 : null;
    };
    if (isOpen) {
      return studentsInClass(classKey).map((s) => ({ s, mark: sheet?.marks[s.id] ?? null, prevPct: prevPctOf(s.id) }));
    }
    const res = classResults(classKey, exam)!;
    const idx = res.subjects.findIndex((s) => s.id === subjectId);
    return res.table.map((t) => ({ s: t.student, mark: idx >= 0 ? t.marks[idx] : null, prevPct: prevPctOf(t.student.id) }));
  }, [classKey, exam, prevExam, isOpen, sheet, subjectId]);

  const nums = rows.map((r) => r.mark).filter((m): m is number => typeof m === "number");
  const pcts = nums.map((m) => (m / exam.max) * 100);
  const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
  const gradeAvg = !isOpen ? gradeSubjectAvg(ref.grade, subjectId, exam) : null;
  const entered = rows.filter((r) => r.mark !== null).length;
  const distribution = CBSE_GRADES.map((g) => pcts.filter((p) => gradeFor(p) === g.grade).length);
  const support = rows
    .filter((r): r is Row & { mark: number } => typeof r.mark === "number" && (r.mark / exam.max) * 100 < 50)
    .sort((a, b) => a.mark - b.mark);

  const submit = () => {
    setState((st) => ({ gradebook: { ...st.gradebook, [sheetKey]: { marks: st.gradebook[sheetKey]?.marks ?? {}, submittedAt: new Date().toISOString() } } }));
    toast({ title: `${label} ${subjectName(subjectId)} marks submitted`, body: `The exam cell will moderate them before results on ${fmtDate(exam.resultsOn)}.` });
  };
  const reopen = () => {
    setState((st) => ({ gradebook: { ...st.gradebook, [sheetKey]: { marks: st.gradebook[sheetKey]?.marks ?? {} } } }));
    toast({ title: "Mark sheet reopened", body: "The exam cell has been told you're making corrections.", tone: "info" });
  };

  return (
    <>
      <PageHeader
        eyebrow={`${subjectName(subjectId)} · ${myClasses.map((c) => classLabel(c.grade, c.section)).join(", ")}`}
        title="Gradebook"
        description={
          isOpen
            ? `Enter ${exam.name} marks as you check papers — every change is saved. Submit the sheet when it's complete.`
            : `${exam.name} results were published on ${fmtDate(exam.resultsOn)} and are locked. Corrections go through the exam cell.`
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="scroll-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented
            label="Class"
            value={classKey}
            onChange={setClassKey}
            options={myClasses.map((c) => ({ value: c.key, label: <>{classLabel(c.grade, c.section)}{c.key === teacher.classTeacherOf && <span className="text-[10.5px] font-semibold text-brand">CT</span>}</> }))}
          />
        </div>
        <div className="scroll-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented
            label="Exam"
            value={examId}
            onChange={setExamId}
            options={exams.map((e) => ({ value: e.id, label: e.resultsOn > t0 ? <>{e.short} <span className="rounded bg-warn-soft px-1 text-[10.5px] text-warn">open</span></> : e.short }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={`${label} average`}
          value={avg === null ? "—" : `${avg.toFixed(1)}%`}
          delta={gradeAvg !== null && avg !== null ? <Delta value={avg - gradeAvg} format={(n) => `${n.toFixed(1)} pts`} suffix={`vs ${gradeLabel(ref.grade)}`} /> : undefined}
          sub={isOpen ? `${entered} of ${rows.length} entered` : undefined}
        />
        <Stat label="Highest" value={nums.length ? `${Math.max(...nums)}/${exam.max}` : "—"} sub={nums.length ? rows.find((r) => r.mark === Math.max(...nums))?.s.name : "No marks yet"} />
        <Stat
          label="Below 33%"
          value={String(pcts.filter((p) => p < 33).length)}
          sub={pcts.filter((p) => p < 33).length ? "Re-test before the next exam" : "Everyone has passed"}
        />
        <Stat label="Below 50%" value={String(support.length)} sub="Extra practice sheets, Tue & Thu" />
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          {isOpen ? (
            <EntrySheet
              key={sheetKey}
              sheetKey={sheetKey}
              exam={exam}
              rows={rows}
              submittedAt={sheet?.submittedAt}
              label={label}
              onSubmit={submit}
              onReopen={reopen}
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div>
                  <h2 className="text-[14px] font-semibold">
                    {label} · {subjectName(subjectId)} · {exam.short}
                  </h2>
                  <p className="text-[12.5px] text-muted">Marks out of {exam.max}</p>
                </div>
                <Badge tone="neutral">
                  <Lock className="size-3" /> Published {fmtDay(exam.resultsOn)}
                </Badge>
              </div>
              <Table>
                <THead>
                  <tr>
                    <Th className="w-14">Roll</Th>
                    <Th>Student</Th>
                    <Th align="right">Marks</Th>
                    <Th className="hidden w-[160px] sm:table-cell">Score</Th>
                    <Th align="center">Grade</Th>
                    {prevExam && <Th align="right">vs {prevExam.short}</Th>}
                  </tr>
                </THead>
                <tbody>
                  {[...rows]
                    .sort((a, b) => a.s.roll - b.s.roll)
                    .map((r) => {
                      const m = r.mark as number;
                      const pct = (m / exam.max) * 100;
                      return (
                        <Tr key={r.s.id}>
                          <Td className="tnum text-muted">{String(r.s.roll).padStart(2, "0")}</Td>
                          <Td>
                            <Link href={`/students/${r.s.id}`} className="flex items-center gap-2.5 hover:underline">
                              <Avatar name={r.s.name} size={26} />
                              <span className="font-medium whitespace-nowrap">{r.s.name}</span>
                            </Link>
                          </Td>
                          <Td align="right" className={cn("font-semibold", pct < 33 && "text-bad")}>
                            {m}
                            <span className="font-normal text-muted">/{exam.max}</span>
                          </Td>
                          <Td className="hidden sm:table-cell">
                            <Meter value={pct / 100} tone={pct < 33 ? "bad" : pct < 50 ? "warn" : "brand"} label={`${r.s.name} score`} />
                          </Td>
                          <Td align="center">
                            <Badge tone={gradeTone(gradeFor(pct))}>{gradeFor(pct)}</Badge>
                          </Td>
                          {prevExam && <Td align="right">{r.prevPct !== null ? <Delta value={pct - r.prevPct} format={(n) => n.toFixed(0)} /> : "—"}</Td>}
                        </Tr>
                      );
                    })}
                </tbody>
              </Table>
            </>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Grade distribution" description={`${label} · ${subjectName(subjectId)} · ${exam.short}`} />
            <CardBody>
              {pcts.length ? (
                <ColumnChart
                  ariaLabel={`Students at each CBSE grade in ${subjectName(subjectId)}`}
                  categories={CBSE_GRADES.map((g) => g.grade)}
                  series={[{ id: "n", label: "Students", color: SERIES.s1, values: distribution }]}
                  valueFormat={(n) => plural(n, "student")}
                  height={180}
                />
              ) : (
                <p className="py-10 text-center text-[13px] text-muted">The chart fills in as you enter marks.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Needs support" description={`Under 50% in ${subjectName(subjectId)} · ${exam.short}`} />
            {support.length ? (
              <ul className="border-t border-line px-5 py-1">
                {support.map((r) => {
                  const pct = (r.mark / exam.max) * 100;
                  return (
                    <li key={r.s.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                      <Avatar name={r.s.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{r.s.name}</p>
                        <p className="truncate text-[12px] text-muted">
                          {r.prevPct !== null ? <>was {r.prevPct.toFixed(0)}% in {prevExam?.short}</> : `Roll ${r.s.roll}`}
                        </p>
                      </div>
                      <span className={cn("tnum text-[13px] font-semibold", pct < 33 ? "text-bad" : "text-warn")}>
                        {r.mark}/{exam.max}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t border-line px-5 py-4 text-[13px] text-muted">{pcts.length ? `Everyone in ${label} scored 50% or more.` : "Shows up once marks are in."}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

// ——— Marks entry ————————————————————————————————————————————————————

function EntrySheet({
  sheetKey,
  exam,
  rows,
  submittedAt,
  label,
  onSubmit,
  onReopen,
}: {
  sheetKey: string;
  exam: Exam;
  rows: Row[];
  submittedAt?: string;
  label: string;
  onSubmit: () => void;
  onReopen: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.s.id, typeof r.mark === "number" ? String(r.mark) : ""])));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const locked = Boolean(submittedAt);
  const max = exam.max;

  const errorOf = (v: string) => {
    if (v.trim() === "") return null;
    const n = Number(v);
    if (Number.isNaN(n)) return "Numbers only";
    if (n < 0 || n > max) return `0–${max} only`;
    if (Math.round(n * 2) !== n * 2) return "Use whole or half marks";
    return null;
  };

  const write = (id: string, value: number | "AB" | null) =>
    setState((st) => {
      const cur = st.gradebook[sheetKey]?.marks ?? {};
      const marks = { ...cur };
      if (value === null) delete marks[id];
      else marks[id] = value;
      return { gradebook: { ...st.gradebook, [sheetKey]: { ...st.gradebook[sheetKey], marks } } };
    });

  const onChange = (id: string, v: string) => {
    setDraft((d) => ({ ...d, [id]: v }));
    // an invalid entry clears the saved mark so totals never use a half-typed number
    write(id, errorOf(v) || v.trim() === "" ? null : Number(v));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
      inputs.current[i + 1]?.select();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
      inputs.current[i - 1]?.select();
    }
  };

  const entered = rows.filter((r) => r.mark !== null).length;
  const errors = rows.filter((r) => errorOf(draft[r.s.id] ?? "")).length;
  const complete = entered === rows.length && errors === 0;

  return (
    <>
      <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold">
            {label} · {exam.name}
          </h2>
          <p className="text-[12.5px] text-muted">
            {locked ? `Submitted ${fmtDay(new Date(submittedAt!))} · with the exam cell for moderation` : `Draft · ${entered} of ${rows.length} entered · saved as you type · out of ${max}`}
          </p>
        </div>
        {locked ? (
          <Button variant="secondary" size="sm" onClick={onReopen}>
            <LockOpen /> Reopen to correct
          </Button>
        ) : (
          <Button variant="primary" size="sm" disabled={!complete} onClick={onSubmit} title={complete ? undefined : "Enter marks (or AB) for every student first"}>
            <Send /> Submit to exam cell
          </Button>
        )}
      </div>
      <div className="px-5 pb-3">
        <Meter value={entered / (rows.length || 1)} tone={complete ? "good" : "brand"} label="Marks entered" />
      </div>
      <Table>
        <THead>
          <tr>
            <Th className="w-14">Roll</Th>
            <Th>Student</Th>
            <Th className="w-[150px]">Marks / {max}</Th>
            <Th align="center" className="w-16">
              Absent
            </Th>
            <Th align="center" className="w-20">
              Grade
            </Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((r, i) => {
            const v = draft[r.s.id] ?? "";
            const err = errorOf(v);
            const ab = r.mark === "AB";
            const n = typeof r.mark === "number" ? r.mark : null;
            return (
              <Tr key={r.s.id} className={cn(ab && "bg-surface-2")}>
                <Td className="tnum text-muted">{String(r.s.roll).padStart(2, "0")}</Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.s.name} size={26} />
                    <span className="font-medium whitespace-nowrap">{r.s.name}</span>
                  </div>
                </Td>
                <Td className="py-1.5">
                  <div className="flex flex-col gap-0.5">
                    <input
                      ref={(el) => {
                        inputs.current[i] = el;
                      }}
                      type="text"
                      inputMode="decimal"
                      value={ab ? "" : v}
                      disabled={locked || ab}
                      placeholder={ab ? "AB" : "—"}
                      aria-label={`${r.s.name} marks out of ${max}`}
                      aria-invalid={Boolean(err)}
                      onChange={(e) => onChange(r.s.id, e.target.value)}
                      onKeyDown={(e) => onKey(e, i)}
                      onFocus={(e) => e.currentTarget.select()}
                      className={cn(
                        "tnum h-9 w-[88px] rounded-lg border bg-surface px-3 text-right text-[14px] font-semibold text-ink transition-[border-color,box-shadow] focus:outline-none focus:ring-[3px] disabled:bg-surface-2 disabled:text-muted",
                        err ? "border-bad focus:border-bad focus:ring-bad/15" : "border-line-strong/90 focus:border-brand focus:ring-[color-mix(in_oklab,var(--brand)_16%,transparent)]",
                      )}
                    />
                    {err && <span className="text-[11.5px] font-medium text-bad">{err}</span>}
                  </div>
                </Td>
                <Td align="center">
                  <button
                    type="button"
                    disabled={locked}
                    aria-pressed={ab}
                    aria-label={`Mark ${r.s.name} absent for the exam`}
                    onClick={() => {
                      if (ab) {
                        write(r.s.id, null);
                      } else {
                        setDraft((d) => ({ ...d, [r.s.id]: "" }));
                        write(r.s.id, "AB");
                      }
                    }}
                    className={cn(
                      "h-7 rounded-md border px-2 text-[11.5px] font-semibold transition-colors disabled:opacity-60",
                      ab ? "border-ink-2 bg-ink-2 text-white" : "border-line-strong/80 text-muted hover:text-ink",
                    )}
                  >
                    AB
                  </button>
                </Td>
                <Td align="center">{n !== null && !err ? <Badge tone={gradeTone(gradeFor((n / max) * 100))}>{gradeFor((n / max) * 100)}</Badge> : <span className="text-faint">—</span>}</Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
      <div className="border-t border-line px-5 py-3 text-[12px] text-muted">
        Press Enter to move to the next student. Half marks are allowed; mark AB for students absent on the exam day.
      </div>
    </>
  );
}


