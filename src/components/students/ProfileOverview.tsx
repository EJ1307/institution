"use client";

import { ArrowRight, Bus, ChevronLeft, ChevronRight, HeartPulse, Phone, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Legend, SERIES } from "@/components/charts/misc";
import { EmptyState, KeyValue } from "@/components/ui/layout";
import { Avatar, Badge, Button, Card, CardBody, CardHeader, cn, Delta } from "@/components/ui/primitives";
import { currentSchoolDay, studentSummary } from "@/lib/data/attendance";
import { academicYear, schoolDaysBetween } from "@/lib/data/calendar";
import { latestExam, reportCard, type ReportRow } from "@/lib/data/exams";
import { feeAccount } from "@/lib/data/fees";
import { classTeacher, type Student } from "@/lib/data/people";
import { classLabel, hasMarks } from "@/lib/data/school";
import { ROUTE_BY_ID } from "@/lib/data/transport";
import { fmtDate, fmtDay, fmtMonthYear, number, percent, rupees } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { CalendarLegend, MonthCalendar } from "./MonthCalendar";
import { classRate, medicalFor } from "./profileData";
import type { ProfileTab } from "./StudentProfile";
import { fmtAge } from "./shared";

export function ProfileOverview({ student: s, canFees, canLedger, onTab }: { student: Student; canFees: boolean; canLedger: boolean; onTab: (t: ProfileTab) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
        <AttendanceCard student={s} onTab={onTab} />
        <ExamCard student={s} onTab={onTab} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        {canFees && <FeeCard student={s} onTab={canLedger ? onTab : undefined} />}
        <ContactCard student={s} />
        <MedicalCard student={s} />
      </div>
    </div>
  );
}

// ——— Attendance ——————————————————————————————————————————————————

function AttendanceCard({ student: s, onTab }: { student: Student; onTab: (t: ProfileTab) => void }) {
  const store = useAppState((st) => st.attendance);
  const day = currentSchoolDay();
  const ay = academicYear(day);
  const current = new Date(day.getFullYear(), day.getMonth(), 1);
  const [anchor, setAnchor] = useState(current);

  const stats = useMemo(() => {
    const days = schoolDaysBetween(ay.start, day);
    return { days, sum: studentSummary(s, days), cls: classRate(s.classKey, days) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, store, day.getTime()]);

  const prevMonth = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  const canBack = prevMonth > ay.start;
  const canFwd = anchor < current;
  const diff = (stats.sum.rate - stats.cls) * 100;

  return (
    <Card>
      <CardHeader
        title={`Attendance · AY ${ay.label} so far`}
        description={`${stats.days.length} school days since ${fmtDay(ay.start)}`}
        action={
          <Button variant="ghost" size="sm" onClick={() => onTab("attendance")}>
            Full record <ArrowRight />
          </Button>
        }
      />
      <CardBody>
        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          <div className="flex shrink-0 flex-col gap-4 lg:w-[188px]">
            <div>
              <div className={cn("tnum text-[34px] leading-none font-semibold tracking-[-0.02em]", stats.sum.rate < 0.75 ? "text-bad" : "text-ink")}>{percent(stats.sum.rate)}</div>
              <div className="mt-2">
                <Delta value={diff} format={(n) => `${n.toFixed(1)} pts`} suffix={`vs ${classLabel(s.grade, s.section)} (${percent(stats.cls)})`} />
              </div>
              {stats.sum.rate < 0.75 && <p className="mt-2 text-[12px] leading-snug text-bad">Below the 75% CBSE requires to sit the board exams.</p>}
            </div>
            <dl className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-2">
              {[
                { k: "Present", v: stats.sum.present },
                { k: "Late", v: stats.sum.late },
                { k: "Absent", v: stats.sum.absent },
                { k: "Leave", v: stats.sum.leave },
              ].map((x) => (
                <div key={x.k} className="bg-surface px-3 py-2">
                  <dt className="text-[11.5px] text-muted">{x.k}</dt>
                  <dd className="tnum text-[15px] font-semibold text-ink">{number(x.v)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-end gap-1">
              <span className="mr-auto text-[12px] text-muted lg:hidden">{fmtMonthYear(anchor)}</span>
              <Button size="icon-sm" variant="ghost" disabled={!canBack} onClick={() => setAnchor(prevMonth)} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <Button size="icon-sm" variant="ghost" disabled={!canFwd} onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <MonthCalendar student={s} month={prevMonth} today={day} className="hidden sm:block" />
              <MonthCalendar student={s} month={anchor} today={day} />
            </div>
            <CalendarLegend className="mt-4" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ——— Latest exam ————————————————————————————————————————————————————

function ExamCard({ student: s, onTab }: { student: Student; onTab: (t: ProfileTab) => void }) {
  const exam = latestExam();
  const rc = useMemo(() => reportCard(s, exam), [s, exam]);
  if (!hasMarks(s.grade) || !rc) {
    return (
      <Card>
        <CardHeader title="Progress" description="Pre-primary" />
        <EmptyState
          title="No marks in pre-primary"
          body={`${s.firstName}'s progress is recorded as observations across language, numeracy, motor skills and social development, shared with parents at the end of each term.`}
          className="py-8"
        />
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title={exam.name}
        description={`Results published ${fmtDay(exam.resultsOn)} · ${rc.rows.length} subjects`}
        action={
          <Button variant="ghost" size="sm" onClick={() => onTab("academics")}>
            All exams <ArrowRight />
          </Button>
        }
      />
      <CardBody>
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <div className="grid shrink-0 grid-cols-3 gap-4 lg:w-[188px] lg:grid-cols-1 lg:gap-3">
            <div>
              <div className="text-[12px] text-muted">Total</div>
              <div className="tnum text-[22px] leading-tight font-semibold text-ink">
                {rc.total}
                <span className="text-[14px] font-medium text-muted">/{rc.max}</span>
              </div>
              <div className="tnum text-[12px] text-muted">{rc.pct.toFixed(1)}%</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">Overall grade</div>
              <div className="text-[22px] leading-tight font-semibold text-ink">{rc.grade}</div>
              <div className="text-[12px] text-muted">CBSE 8-point scale</div>
            </div>
            <div>
              <div className="text-[12px] text-muted">Class rank</div>
              <div className="tnum text-[22px] leading-tight font-semibold text-ink">
                {rc.rank}
                <span className="text-[14px] font-medium text-muted"> of {rc.classSize}</span>
              </div>
              <div className="text-[12px] text-muted">{classLabel(s.grade, s.section)}</div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <Legend
              className="mb-3"
              items={[
                { label: s.firstName, color: SERIES.s1 },
                { label: "Class average", color: SERIES.s2 },
              ]}
            />
            <SubjectBars rows={rc.rows} />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function SubjectBars({ rows }: { rows: ReportRow[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const avgPct = (r.classAvg / r.max) * 100;
        const diff = r.pct - avgPct;
        return (
          <li key={r.subject.id} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 sm:grid-cols-[120px_1fr_auto]">
            <span className="truncate text-[12.5px] text-ink-2">{r.subject.name}</span>
            <div className="relative h-2.5" title={`${r.subject.name}: ${r.marks}/${r.max} · class average ${r.classAvg.toFixed(1)}`}>
              <div className="absolute inset-0 rounded-full bg-ink/[0.05]" />
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${r.pct}%`, background: SERIES.s1 }} />
              <div className="absolute -top-1 -bottom-1 w-[3px] rounded-full ring-2 ring-surface" style={{ left: `calc(${avgPct}% - 1.5px)`, background: SERIES.s2 }} />
            </div>
            <span className="flex w-[104px] items-baseline justify-end gap-2">
              <span className="tnum text-[13px] font-semibold text-ink">
                {r.marks}
                <span className="font-normal text-muted">/{r.max}</span>
              </span>
              <span className={cn("tnum w-10 text-right text-[11.5px]", diff >= 0 ? "text-good" : "text-muted")}>
                {diff >= 0 ? "+" : "−"}
                {Math.abs(diff).toFixed(0)}
              </span>
              <span className="w-5 text-[11.5px] font-medium text-muted">{r.grade}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ——— Fees ————————————————————————————————————————————————————————

const INST_TONE = {
  paid: "bg-good-soft text-good",
  due: "bg-warn-soft text-warn",
  overdue: "bg-bad-soft text-bad",
  upcoming: "bg-ink/[0.045] text-muted",
} as const;

function FeeCard({ student: s, onTab }: { student: Student; onTab?: (t: ProfileTab) => void }) {
  const payments = useAppState((st) => st.payments);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const acc = useMemo(() => feeAccount(s), [s, payments]);
  return (
    <Card>
      <CardHeader
        title="Fees"
        description={`Annual ${rupees(acc.annual)}${s.concession ? ` after ${s.concession.pct}% ${s.concession.label.toLowerCase()} concession` : ""}`}
        action={
          onTab ? (
            <Button variant="ghost" size="sm" onClick={() => onTab("fees")}>
              Ledger
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[12px] text-muted">{acc.outstanding > 0 ? (acc.overdue > 0 ? "Overdue" : "Due now") : "Outstanding"}</div>
            <div className={cn("tnum text-[24px] leading-tight font-semibold", acc.overdue > 0 ? "text-bad" : "text-ink")}>{rupees(acc.outstanding)}</div>
          </div>
          <div className="text-right text-[12px] text-muted">
            <div>Paid this year</div>
            <div className="tnum text-[14px] font-semibold text-ink">{rupees(acc.paid)}</div>
          </div>
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-1.5">
          {acc.instalments.map((i) => (
            <li key={i.id} className={cn("rounded-lg px-2 py-1.5 text-center", INST_TONE[i.status])} title={`${i.label} · ${i.covers} · ${i.status}`}>
              <div className="text-[12px] font-semibold">{i.id}</div>
              <div className="text-[10.5px] capitalize opacity-90">{i.status === "upcoming" ? fmtDay(i.due) : i.status}</div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[12.5px] text-muted">
          {acc.nextDue
            ? acc.nextDue.status === "overdue"
              ? `${acc.nextDue.label} was due on ${fmtDay(acc.nextDue.due)}${acc.nextDue.lateFee ? `, including a ${rupees(acc.nextDue.lateFee)} late fee` : ""}.`
              : `${acc.nextDue.label} (${acc.nextDue.covers}) of ${rupees(acc.nextDue.amount)} is due on ${fmtDay(acc.nextDue.due)}.`
            : "Nothing due right now. The next invoice goes out 25 days before its due date."}
        </p>
      </CardBody>
    </Card>
  );
}

// ——— Contact ————————————————————————————————————————————————————————

function ContactCard({ student: s }: { student: Student }) {
  const route = s.routeId ? ROUTE_BY_ID[s.routeId] : null;
  const ct = classTeacher(s.classKey);
  return (
    <Card>
      <CardHeader title="Guardians & contact" icon={<UsersRound />} />
      <ul className="px-5">
        {s.guardians.map((g, i) => (
          <li key={g.name} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
            <Avatar name={g.name} size={34} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-[13px] font-medium text-ink">
                {g.name}
                {i === 0 && <span className="text-[11px] font-normal text-muted">Primary</span>}
              </p>
              <p className="truncate text-[12px] text-muted">
                {g.relation} · {g.occupation}
              </p>
            </div>
            <a href={`tel:${g.phone.replace(/\s/g, "")}`} className="tnum inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] whitespace-nowrap text-ink-2 hover:bg-ink/5 hover:text-ink">
              <Phone className="size-3.5 text-muted" aria-hidden />
              {g.phone.replace("+91 ", "")}
            </a>
          </li>
        ))}
      </ul>
      <dl className="mx-5 mt-1 mb-4 divide-y divide-line border-t border-line">
        <KeyValue k="Address" v={`${s.locality}, Gurugram`} />
        <KeyValue
          k="Transport"
          v={
            route ? (
              <span className="inline-flex items-center gap-1.5">
                <Bus className="size-3.5 text-muted" aria-hidden />
                Bus {route.id} · {route.name}
              </span>
            ) : (
              "Own arrangement"
            )
          }
        />
        <KeyValue k="Date of birth" v={<span className="tnum">{`${fmtDate(new Date(s.dob))} · ${fmtAge(new Date(s.dob), new Date())}`}</span>} />
        {ct && <KeyValue k="Class teacher" v={`${ct.title} ${ct.name}`} />}
      </dl>
    </Card>
  );
}

// ——— Medical ————————————————————————————————————————————————————————

function MedicalCard({ student: s }: { student: Student }) {
  const m = medicalFor(s, new Date());
  return (
    <Card>
      <CardHeader title="Medical" icon={<HeartPulse />} description={`Annual check-up on ${fmtDay(m.checkup)}`} />
      <CardBody className="pt-0">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge tone="outline">Blood group {s.bloodGroup}</Badge>
          {m.allergies.length ? m.allergies.map((a) => <Badge key={a} tone="warn">Allergy: {a}</Badge>) : <Badge tone="neutral">No known allergies</Badge>}
        </div>
        <dl className="divide-y divide-line">
          {m.conditions.map((c) => (
            <KeyValue key={c} k="Condition" v={c} />
          ))}
          <KeyValue k="Height · weight" v={<span className="tnum">{`${m.height} cm · ${m.weight} kg`}</span>} />
          <KeyValue k="Vision" v={m.vision} />
        </dl>
      </CardBody>
    </Card>
  );
}
