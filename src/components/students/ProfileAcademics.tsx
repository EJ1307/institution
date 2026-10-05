"use client";

import { BookOpenCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { Legend, SERIES } from "@/components/charts/misc";
import { EmptyState } from "@/components/ui/layout";
import { Badge, Card, CardBody, CardHeader, cn } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { today } from "@/lib/data/calendar";
import { classTeacher, type Student } from "@/lib/data/people";
import { classLabel, hasMarks } from "@/lib/data/school";
import { fmtDay } from "@/lib/format";
import { SubjectBars } from "./ProfileOverview";
import { examHistory } from "./profileData";

export function ProfileAcademics({ student: s }: { student: Student }) {
  const history = useMemo(() => examHistory(s, today()), [s]);
  const [selected, setSelected] = useState<string | null>(null);
  const label = classLabel(s.grade, s.section);

  if (!hasMarks(s.grade) || history.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BookOpenCheck />}
          title={hasMarks(s.grade) ? "No results published yet" : "Pre-primary has no marks"}
          body={
            hasMarks(s.grade)
              ? `${s.firstName}'s first results will appear here once the Periodic Test 1 results are published.`
              : `In pre-primary, ${s.firstName}'s teachers record observations across language, numeracy, motor skills and social development. A progress report is shared with parents at the end of each term.`
          }
          className="py-16"
        />
      </Card>
    );
  }

  const current = history.find((h) => h.exam.id === selected) ?? history[history.length - 1];
  const tick = (i: number) => (history[i].ay !== history[i - 1]?.ay || i === history.length - 1 || i === 0 ? `${history[i].exam.short} ’${history[i].ay.slice(2, 4)}` : history[i].exam.short);
  const best = [...current.rc.rows].sort((a, b) => b.pct - a.pct)[0];
  const weakest = [...current.rc.rows].sort((a, b) => a.pct - b.pct)[0];
  const first = history[0];
  const last = history[history.length - 1];
  const vals = history.flatMap((h) => [h.rc.pct, h.classAvg]);
  const yDomain: [number, number] = [Math.max(0, Math.floor((Math.min(...vals) - 2) / 5) * 5), Math.min(100, Math.ceil((Math.max(...vals) + 2) / 5) * 5)];
  const ct = classTeacher(s.classKey);
  const remark = remarkFor(s, current.rc.pct, best.subject.name, weakest.subject.name);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Overall percentage, exam by exam" description={history.length > 1 ? `${history.length} exams since ${first.exam.short} ${first.ay}` : "First exam on record"} />
          <CardBody>
            <Legend
              kind="line"
              className="mb-4"
              items={[
                { label: s.firstName, color: SERIES.s1 },
                { label: `${label} average`, color: SERIES.s2 },
              ]}
            />
            <LineChart
              ariaLabel={`${s.name}'s overall percentage across exams, compared with the class average`}
              labels={history.map((h) => `${h.exam.name} · ${h.ay}`)}
              tickLabel={(i) => tick(i)}
              series={[
                { id: "me", label: s.firstName, color: SERIES.s1, values: history.map((h) => h.rc.pct) },
                { id: "cls", label: `${label} average`, color: SERIES.s2, values: history.map((h) => h.classAvg) },
              ]}
              yDomain={yDomain}
              yFormat={(n) => `${Math.round(n)}%`}
              valueFormat={(n) => `${n.toFixed(1)}%`}
              endLabel
              height={240}
            />
          </CardBody>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="At a glance" description={`${current.exam.name} · ${current.ay}`} />
          <CardBody className="flex flex-1 flex-col gap-4">
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
              <div className="bg-surface px-3 py-2.5">
                <div className="text-[12px] text-muted">Overall</div>
                <div className="tnum text-[20px] font-semibold text-ink">{current.rc.pct.toFixed(1)}%</div>
              </div>
              <div className="bg-surface px-3 py-2.5">
                <div className="text-[12px] text-muted">Rank</div>
                <div className="tnum text-[20px] font-semibold text-ink">
                  {current.rc.rank}
                  <span className="text-[13px] font-medium text-muted"> / {current.rc.classSize}</span>
                </div>
              </div>
            </div>
            <dl className="flex flex-col gap-2.5 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Strongest</dt>
                <dd className="text-right text-ink">
                  {best.subject.name} <span className="tnum text-muted">· {best.grade}</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Needs attention</dt>
                <dd className="text-right text-ink">
                  {weakest.subject.name} <span className="tnum text-muted">· {weakest.grade}</span>
                </dd>
              </div>
              {history.length > 1 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Since {first.exam.short} ’{first.ay.slice(2, 4)}</dt>
                  <dd className={cn("tnum text-right font-medium", last.rc.pct >= first.rc.pct ? "text-good" : "text-bad")}>
                    {last.rc.pct >= first.rc.pct ? "+" : "−"}
                    {Math.abs(last.rc.pct - first.rc.pct).toFixed(1)} pts
                  </dd>
                </div>
              )}
            </dl>
            <figure className="mt-auto rounded-lg bg-surface-2 px-4 py-3">
              <figcaption className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">Class teacher&apos;s remark</figcaption>
              <blockquote className="title-serif text-[13.5px] leading-relaxed text-ink-2">“{remark}”</blockquote>
              {ct && <div className="mt-1.5 text-[12px] text-muted">— {ct.title} {ct.name}</div>}
            </figure>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Published exams" description="Select an exam to see subject-wise marks" />
        <Table>
          <THead>
            <tr>
              <Th>Exam</Th>
              <Th className="hidden sm:table-cell">Results</Th>
              <Th align="right">Total</Th>
              <Th align="right">Percentage</Th>
              <Th align="center">Grade</Th>
              <Th align="right">Rank</Th>
              <Th align="right" className="hidden md:table-cell">
                Class average
              </Th>
            </tr>
          </THead>
          <tbody>
            {[...history].reverse().map((h) => {
              const active = h.exam.id === current.exam.id;
              return (
                <Tr
                  key={h.exam.id}
                  onClick={() => setSelected(h.exam.id)}
                  aria-selected={active}
                  className={cn(active && "bg-brand-soft/60 hover:bg-brand-soft/80")}
                >
                  <Td>
                    <button type="button" onClick={() => setSelected(h.exam.id)} className="text-left">
                      <span className={cn("block font-medium", active ? "text-brand" : "text-ink")}>{h.exam.name}</span>
                      <span className="block text-[12px] text-muted">AY {h.ay}</span>
                    </button>
                  </Td>
                  <Td className="tnum hidden text-ink-2 sm:table-cell">{fmtDay(h.exam.resultsOn)}</Td>
                  <Td align="right">
                    {h.rc.total}
                    <span className="text-muted">/{h.rc.max}</span>
                  </Td>
                  <Td align="right" className="font-medium text-ink">
                    {h.rc.pct.toFixed(1)}%
                  </Td>
                  <Td align="center">
                    <Badge tone="outline">{h.rc.grade}</Badge>
                  </Td>
                  <Td align="right">
                    {h.rc.rank}
                    <span className="text-muted"> / {h.rc.classSize}</span>
                  </Td>
                  <Td align="right" className="hidden text-muted md:table-cell">
                    {h.classAvg.toFixed(1)}%
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title={`Subject-wise · ${current.exam.name}`} description={`AY ${current.ay} · out of ${current.exam.max} in each subject`} />
          <Table>
            <THead>
              <tr>
                <Th>Subject</Th>
                <Th align="right">Marks</Th>
                <Th align="center">Grade</Th>
                <Th align="right">Class avg</Th>
                <Th align="right" className="hidden sm:table-cell">
                  Highest
                </Th>
              </tr>
            </THead>
            <tbody>
              {current.rc.rows.map((r) => (
                <Tr key={r.subject.id}>
                  <Td className="font-medium text-ink">{r.subject.name}</Td>
                  <Td align="right">
                    <span className="font-medium text-ink">{r.marks}</span>
                    <span className="text-muted">/{r.max}</span>
                  </Td>
                  <Td align="center">
                    <span className={cn("text-[12.5px] font-semibold", r.grade.startsWith("A") ? "text-good" : r.grade === "D" || r.grade === "E" ? "text-bad" : "text-ink-2")}>{r.grade}</span>
                  </Td>
                  <Td align="right" className="text-ink-2">
                    {r.classAvg.toFixed(1)}
                  </Td>
                  <Td align="right" className="hidden text-ink-2 sm:table-cell">
                    {r.highest}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Against the class" description="Bar: marks · tick: class average" />
          <CardBody>
            <SubjectBars rows={current.rc.rows} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function remarkFor(s: Student, pct: number, best: string, weakest: string) {
  const he = s.gender === "F" ? "she" : "he";
  const his = s.gender === "F" ? "her" : "his";
  if (pct >= 85) return `${s.firstName} is a diligent learner who takes real ownership of ${his} work. ${his[0].toUpperCase() + his.slice(1)} answers in ${best} show depth; the same care in ${weakest} will make the result even stronger.`;
  if (pct >= 70) return `${s.firstName} is attentive in class and steady across subjects. Regular revision in ${weakest} will lift the overall result; ${he} should keep reading beyond the textbook in ${best}.`;
  if (pct >= 55) return `${s.firstName} participates willingly but needs to revise more consistently. Extra practice in ${weakest} is recommended — the subject teacher is available after school on Wednesdays.`;
  return `${s.firstName} needs closer support this term. We would like to meet ${his} parents to plan a revision schedule, starting with ${weakest}.`;
}
