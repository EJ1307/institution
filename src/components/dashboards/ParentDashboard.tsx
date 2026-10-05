"use client";

import { ArrowRight, Bus, CalendarDays, Check, ChevronRight, IndianRupee, MessageSquareText, NotebookPen, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarList, SERIES } from "@/components/charts/misc";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, ButtonLink, Card, CardHeader, cn } from "@/components/ui/primitives";
import { currentSchoolDay, markFor, studentSummary } from "@/lib/data/attendance";
import { academicYear, schoolDaysBack, schoolDaysBetween, today } from "@/lib/data/calendar";
import { homeworkFor, notices, upcomingEvents } from "@/lib/data/communication";
import { latestExam, reportCard } from "@/lib/data/exams";
import { feeAccount } from "@/lib/data/fees";
import { classTeacher } from "@/lib/data/people";
import { classLabel, hasMarks } from "@/lib/data/school";
import { busStatus, ROUTE_BY_ID } from "@/lib/data/transport";
import { fmtClock, fmtDay, fmtWeekday, fmtWeekdayLong, greeting, percent, relativeDays, rupees } from "@/lib/format";
import { stopIndexFor } from "@/components/transport/live";
import { useChild } from "@/lib/session";
import { getState, setState, useAppState } from "@/lib/store";

const MARK_STYLE: Record<string, { label: string; cls: string }> = {
  P: { label: "Present", cls: "bg-good" },
  L: { label: "Late", cls: "bg-[#D9961F]" },
  A: { label: "Absent", cls: "bg-bad" },
  E: { label: "On leave", cls: "bg-info" },
};

export function ParentDashboard() {
  const { child } = useChild();
  const toast = useToast();
  const payments = useAppState((s) => s.payments);
  const acks = useAppState((s) => s.acks);
  const homeworkDone = useAppState((s) => s.homeworkDone);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const day = currentSchoolDay();
  const ay = academicYear(day);
  const teacher = classTeacher(child.classKey);
  const todayMark = markFor(child, day);

  const att = useMemo(() => {
    const term = studentSummary(child, schoolDaysBetween(ay.start, day));
    const recent = schoolDaysBack(20, day).map((d) => ({ d, m: markFor(child, d) }));
    return { term, recent };
  }, [child, ay.start, day]);

  const fees = useMemo(() => feeAccount(child), [child, payments]);
  const report = hasMarks(child.grade) ? reportCard(child, latestExam()) : null;
  const route = child.routeId ? ROUTE_BY_ID[child.routeId] : null;
  const bus = route ? busStatus(route, now) : null;
  const myStop = route ? route.stops[stopIndexFor(child, route)] : null;
  const hw = useMemo(() => homeworkFor(child.classKey, child.grade, child.section).filter((h) => h.dueOn >= today()).slice(0, 4), [child]);
  const needAck = notices().filter((n) => n.requiresAck && /parents/i.test(n.audience) && (n.audience.includes("All") || n.audience.includes(gradeWord(child.grade)) || n.audience.includes(child.routeId ?? "—")));

  return (
    <>
      {/* Greeting + child */}
      <div className="mb-6">
        <p className="eyebrow">{fmtWeekdayLong(today())}</p>
        <h1 className="title-serif mt-1.5 text-[26px] leading-tight font-semibold sm:text-[30px]">{greeting(now)}, Rohan</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="relative flex flex-col gap-5 bg-brand-deep px-5 py-5 text-white sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-4">
            <Avatar name={child.name} size={56} className="ring-2 ring-white/15" />
            <div>
              <p className="title-serif text-[22px] leading-tight font-semibold">{child.name}</p>
              <p className="mt-1 text-[13px] text-white/65">
                Class {classLabel(child.grade, child.section)} · Roll {child.roll} · {child.house} house
              </p>
            </div>
          </div>
          <div className="flex-1" />
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/10 text-center sm:min-w-[420px]">
            <TodayCell label={day.getTime() === today().getTime() ? "Today" : fmtWeekday(day)}>
              {todayMark ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", MARK_STYLE[todayMark].cls)} />
                  {MARK_STYLE[todayMark].label}
                </span>
              ) : (
                "Not marked"
              )}
            </TodayCell>
            <TodayCell label="Attendance">{percent(att.term.rate, 0)}</TodayCell>
            <TodayCell label="School bus">{bus ? (bus.phase === "morning" || bus.phase === "afternoon" ? "On the way" : bus.phase === "done" ? "Dropped" : "At school") : "Not opted"}</TodayCell>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Fees */}
        <Card className="lg:order-1">
          <CardHeader title="Fees" icon={<IndianRupee />} action={<ButtonLink href="/fees" variant="ghost" size="sm">Details</ButtonLink>} />
          <div className="px-5 pb-5">
            {fees.nextDue ? (
              <>
                <p className="text-[12.5px] text-muted">
                  {fees.nextDue.label} · {fees.nextDue.covers}
                </p>
                <p className="mt-1 text-[28px] leading-none font-semibold tracking-[-0.02em]">{rupees(fees.nextDue.amount)}</p>
                <p className={cn("mt-2 text-[12.5px] font-medium", fees.nextDue.status === "overdue" ? "text-bad" : "text-warn")}>
                  {fees.nextDue.status === "overdue" ? `Overdue since ${fmtDay(fees.nextDue.due)}` : `Due ${relativeDays(fees.nextDue.due, today()).toLowerCase()} · ${fmtDay(fees.nextDue.due)}`}
                </p>
                <ButtonLink href="/fees?pay=1" variant="primary" size="lg" className="mt-4 w-full">
                  Pay {rupees(fees.nextDue.amount)}
                </ButtonLink>
                <p className="mt-2.5 text-center text-[11.5px] text-muted">UPI, cards or net banking · instant receipt</p>
              </>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-good-soft px-4 py-3.5 text-good">
                <Check className="size-5" />
                <div>
                  <p className="text-[13.5px] font-semibold">All paid up</p>
                  <p className="text-[12px] text-good/80">{fees.instalments.find((i) => i.status === "upcoming") ? `Next instalment due ${fmtDay(fees.instalments.find((i) => i.status === "upcoming")!.due)}` : "Nothing due this year"}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Attendance */}
        <Card className="lg:order-2">
          <CardHeader title="Attendance" description={`${att.term.present + att.term.late} of ${att.term.total - att.term.unmarked} school days this term`} action={<ButtonLink href="/attendance" variant="ghost" size="sm">Calendar</ButtonLink>} />
          <div className="px-5 pb-5">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] leading-none font-semibold tracking-[-0.02em]">{percent(att.term.rate)}</span>
              <span className="text-[12.5px] text-muted">{att.term.absent} absent · {att.term.leave} leave · {att.term.late} late</span>
            </div>
            <p className="mt-4 mb-2 text-[12px] text-muted">Last 20 school days</p>
            <ol className="grid grid-cols-10 gap-1.5">
              {att.recent.map(({ d, m }) => (
                <li key={d.getTime()} title={`${fmtWeekday(d)}: ${m ? MARK_STYLE[m].label : "—"}`} className={cn("aspect-square rounded-[5px]", m ? MARK_STYLE[m].cls : "bg-line", m === "P" && "opacity-80")}>
                  <span className="sr-only">
                    {fmtWeekday(d)}: {m ? MARK_STYLE[m].label : "not marked"}
                  </span>
                </li>
              ))}
            </ol>
            <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
              {Object.entries(MARK_STYLE).map(([k, v]) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-[3px]", v.cls)} /> {v.label}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Bus */}
        <Card className="lg:order-3">
          <CardHeader title="School bus" icon={<Bus />} action={route ? <ButtonLink href="/transport" variant="ghost" size="sm">Track</ButtonLink> : undefined} />
          <div className="px-5 pb-5">
            {route && bus ? (
              <>
                <div className="flex items-center gap-2">
                  {(bus.phase === "morning" || bus.phase === "afternoon") && <span className="animate-pulse-dot size-2 rounded-full bg-good" />}
                  <p className="text-[15px] font-semibold">
                    {bus.phase === "morning" ? "On the way to school" : bus.phase === "afternoon" ? "On the way home" : bus.label}
                  </p>
                </div>
                <p className="mt-1 text-[12.5px] text-muted">
                  Route {route.id} · {route.name} · {route.bus}
                </p>
                <div className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted">Stop</span>
                    <span className="truncate font-medium">{myStop!.name.split(" · ")[0]}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between">
                    <span className="text-muted">Pick-up</span>
                    <span className="tnum font-medium">{fmtClock(myStop!.am)}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between">
                    <span className="text-muted">Drop</span>
                    <span className="tnum font-medium">{fmtClock(myStop!.pm)}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between">
                    <span className="text-muted">Attendant</span>
                    <span className="font-medium">{route.attendant}</span>
                  </div>
                </div>
                <a href={`tel:${route.driverPhone.replace(/\s/g, "")}`} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline">
                  <Phone className="size-3.5" /> Call transport desk
                </a>
              </>
            ) : (
              <p className="text-[13px] text-muted">{child.firstName} isn&apos;t registered for school transport.</p>
            )}
          </div>
        </Card>

        {/* Results */}
        <Card className="lg:order-4 lg:col-span-2">
          <CardHeader
            title={report ? `${report.exam.name} results` : "Progress"}
            description={report ? `Rank ${report.rank} of ${report.classSize} in ${classLabel(child.grade, child.section)}` : undefined}
            action={<ButtonLink href="/academics" variant="ghost" size="sm">Report card <ArrowRight /></ButtonLink>}
          />
          {report ? (
            <div className="grid grid-cols-1 gap-6 px-5 pb-5 sm:grid-cols-[180px_1fr]">
              <div>
                <p className="text-[40px] leading-none font-semibold tracking-[-0.03em]">{report.pct.toFixed(1)}%</p>
                <p className="mt-2 text-[13px] text-muted">
                  Overall grade <span className="font-semibold text-ink">{report.grade}</span>
                </p>
                <p className="mt-1 text-[13px] text-muted">
                  {report.total} / {report.max} marks
                </p>
              </div>
              <div>
                <BarList
                  rows={report.rows.map((r) => ({ id: r.subject.id, label: r.subject.name, value: r.pct, display: `${r.marks}/${r.max}`, color: SERIES.s1 }))}
                  max={100}
                  labelWidth={112}
                />
                <p className="mt-3 text-[12px] text-muted">Bars show {child.firstName}&apos;s score; class averages are on the report card.</p>
              </div>
            </div>
          ) : (
            <p className="px-5 pb-5 text-[13px] text-muted">Early-years progress is shared as a developmental report each term.</p>
          )}
        </Card>

        {/* Homework */}
        <Card className="lg:order-5">
          <CardHeader title="Homework due" icon={<NotebookPen />} action={<ButtonLink href="/homework" variant="ghost" size="sm">All</ButtonLink>} />
          <ul className="px-5 pb-4">
            {hw.map((h) => {
              const done = Boolean(homeworkDone[h.id]);
              return (
                <li key={h.id} className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                  <button
                    type="button"
                    aria-pressed={done}
                    aria-label={done ? "Mark as not done" : "Mark as done"}
                    onClick={() => setState({ homeworkDone: { ...getState().homeworkDone, [h.id]: !done } })}
                    className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors", done ? "border-brand bg-brand text-white" : "border-line-strong bg-surface hover:border-brand")}
                  >
                    {done && <Check className="size-3.5" strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[13px] leading-snug font-medium", done && "text-muted line-through")}>{h.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {h.subject} · due {relativeDays(h.dueOn, today()).toLowerCase()}
                    </p>
                  </div>
                </li>
              );
            })}
            {hw.length === 0 && <li className="py-2 text-[13px] text-muted">Nothing due. Enjoy the evening.</li>}
          </ul>
        </Card>

        {/* Responses needed */}
        <Card className="lg:order-6 lg:col-span-2">
          <CardHeader title="From school" action={<ButtonLink href="/notices" variant="ghost" size="sm">All notices</ButtonLink>} />
          <ul className="divide-y divide-line border-t border-line">
            {needAck.slice(0, 2).map((n) => (
              <li key={n.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={acks[n.id] ? "good" : "warn"} dot>
                      {acks[n.id] ? "Acknowledged" : "Response needed"}
                    </Badge>
                    <span className="text-[12px] text-muted">{relativeDays(n.postedAt, today())}</span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] font-medium">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{n.body}</p>
                </div>
                {!acks[n.id] && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setState({ acks: { ...getState().acks, [n.id]: new Date().toISOString() } });
                      toast({ title: "Thanks — the school has your response", body: n.title });
                    }}
                  >
                    <Check /> {/consent/i.test(n.title) ? "Give consent" : "Acknowledge"}
                  </Button>
                )}
              </li>
            ))}
            {notices()
              .filter((n) => !n.requiresAck)
              .slice(0, 2)
              .map((n) => (
                <li key={n.id}>
                  <Link href="/notices" className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{n.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {n.author} · {relativeDays(n.postedAt, today())}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-faint" />
                  </Link>
                </li>
              ))}
          </ul>
        </Card>

        {/* Class teacher + events */}
        <Card className="lg:order-7">
          <CardHeader title="Coming up" icon={<CalendarDays />} />
          <ul className="px-5 pb-3">
            {upcomingEvents(4).map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <span className="min-w-0 truncate text-[13px] font-medium">{e.title}</span>
                <span className="shrink-0 text-[12px] text-muted">{relativeDays(e.date, today())}</span>
              </li>
            ))}
          </ul>
          {teacher && (
            <div className="mx-5 mb-5 flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-3">
              <Avatar name={teacher.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{`${teacher.title} ${teacher.name}`}</p>
                <p className="text-[12px] text-muted">Class teacher</p>
              </div>
              <Button variant="secondary" size="icon-sm" aria-label="Message class teacher" onClick={() => toast({ title: "Message thread opened", body: `Your message will reach ${teacher.title} ${teacher.lastName} during school hours.`, tone: "info" })}>
                <MessageSquareText />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function TodayCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-deep/40 px-3 py-3">
      <p className="text-[11px] tracking-[0.04em] text-white/55 uppercase">{label}</p>
      <p className="mt-1 text-[13.5px] font-semibold text-white">{children}</p>
    </div>
  );
}

function gradeWord(grade: string) {
  const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][Number(grade)] ?? grade;
  return `Class ${roman}`;
}
