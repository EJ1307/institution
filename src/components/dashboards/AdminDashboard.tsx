"use client";

import {
  AlertTriangle, ArrowRight, Bus, CalendarClock, ClipboardCheck, Download, IndianRupee, Megaphone, UserPlus, UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ColumnChart } from "@/components/charts/ColumnChart";
import { ATTENDANCE_BINS, attendanceTone, Heatmap } from "@/components/charts/Heatmap";
import { LineChart } from "@/components/charts/LineChart";
import { BarList, Funnel, Legend, SERIES, Sparkline, StackedBar } from "@/components/charts/misc";
import { useToast } from "@/components/ui/overlay";
import { PageHeader, Stat } from "@/components/ui/layout";
import { Avatar, Badge, Button, ButtonLink, Card, CardBody, CardHeader, cn, Delta, Meter } from "@/components/ui/primitives";
import { applications, funnel } from "@/lib/data/admissions";
import {
  classGrid, currentSchoolDay, isMarked, leaveRequests, schoolTrend, staffOnLeave, staffPresence, studentSummary,
} from "@/lib/data/attendance";
import { academicYear, schoolDaysBetween } from "@/lib/data/calendar";
import { notices, upcomingEvents } from "@/lib/data/communication";
import { classResults, latestExam, toppers } from "@/lib/data/exams";
import { ledger, PAYMENT_MODES } from "@/lib/data/fees";
import { students } from "@/lib/data/people";
import { GRADES, classLabel } from "@/lib/data/school";
import { busStatus, ROUTES } from "@/lib/data/transport";
import { fmtDay, fmtMonth, fmtWeekday, fmtWeekdayLong, greeting, number, percent, plural, relativeDays, rupees, rupeesCompact } from "@/lib/format";
import { useBrand, useSession } from "@/lib/session";
import { useAppState } from "@/lib/store";

export function AdminDashboard() {
  const session = useSession();
  const brand = useBrand();
  const router = useRouter();
  const toast = useToast();
  // re-derive when demo actions change the underlying data
  const attendanceStore = useAppState((s) => s.attendance);
  const paymentsStore = useAppState((s) => s.payments);
  const leaveStore = useAppState((s) => s.leaveDecisions);

  const day = currentSchoolDay();
  const ay = academicYear(day);

  const att = useMemo(() => {
    const trend = schoolTrend(30, day);
    const todayRow = trend[trend.length - 1];
    const prior = trend.slice(-21, -1);
    const priorAvg = prior.reduce((a, d) => a + d.rate, 0) / prior.length;
    const grid = classGrid(day);
    return { trend, today: todayRow, priorAvg, grid };
  }, [attendanceStore, day.getTime()]);

  const fees = useMemo(() => ledger(), [paymentsStore]);
  const staffNow = useMemo(() => ({ presence: staffPresence(day), onLeave: staffOnLeave(day), pending: leaveRequests().filter((l) => l.status === "pending") }), [leaveStore, day]);
  const adm = useMemo(() => ({ apps: applications(), funnel: funnel() }), []);
  const exam = latestExam();

  const atRisk = useMemo(() => {
    const days = schoolDaysBetween(ay.start, day);
    return students()
      .filter((s) => s.grade === "10" || s.grade === "12")
      .map((s) => ({ s, ...studentSummary(s, days) }))
      .filter((x) => x.rate < 0.75);
  }, [ay.start, day]);

  const unmarked = att.grid.filter((g) => !isMarked(g.key, day));
  const lowest = [...att.grid].filter((g) => isMarked(g.key, day)).sort((a, b) => a.rate - b.rate)[0];
  const lateBus = ROUTES.map((r) => ({ r, s: busStatus(r, new Date()) })).find((x) => x.s.delay > 2 && (x.s.phase === "morning" || x.s.phase === "afternoon"));

  const collectedPct = fees.collected / (fees.billed || 1);

  const classAverages = useMemo(
    () =>
      GRADES.filter((g) => Number(g.id) >= 1)
        .map((g) => {
          const res = g.sections.map((s) => classResults(`${g.id}-${s}`, exam)).filter(Boolean);
          const avg = res.reduce((a, r) => a + r!.avgPct, 0) / (res.length || 1);
          return { id: g.id, label: g.label.replace("Class ", "Class "), value: avg };
        }),
    [exam],
  );

  const firstName = session?.name.replace(/^Dr\.\s*/, "").split(" ")[1] ?? "";

  return (
    <>
      <PageHeader
        eyebrow={`${fmtWeekdayLong(day)} · AY ${ay.label}`}
        title={`${greeting(new Date())}, Dr. ${firstName}`}
        description={`Here's how ${brand.school.split(" ")[0]} is doing today.`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => toast({ title: "Daily report is being prepared", body: "A PDF will be emailed to principal@amaltas.edu.in in a minute.", tone: "info" })}
            >
              <Download /> Daily report
            </Button>
            <ButtonLink href="/notices?compose=1" variant="primary">
              <Megaphone /> Post notice
            </ButtonLink>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          href="/attendance"
          label={`Students present${day.getTime() !== new Date(new Date().setHours(0, 0, 0, 0)).getTime() ? ` · ${fmtWeekday(day)}` : " today"}`}
          value={percent(att.today.rate)}
          delta={<Delta value={(att.today.rate - att.priorAvg) * 100} format={(n) => `${n.toFixed(1)} pts`} suffix="vs 4-wk avg" />}
          sub={undefined}
          trend={<Sparkline values={att.trend.slice(-20).map((d) => d.rate)} />}
        />
        <Stat
          href="/fees"
          label={`Fees collected · ${ay.label}`}
          value={rupeesCompact(fees.collected)}
          sub={<span className="tnum">{percent(collectedPct, 0)} of {rupeesCompact(fees.billed)} billed · {rupeesCompact(fees.overdue)} overdue</span>}
        />
        <Stat
          href="/staff"
          label="Staff present"
          value={
            <span>
              {staffNow.presence.present}
              <span className="text-[16px] font-medium text-muted">/{staffNow.presence.total}</span>
            </span>
          }
          sub={`${plural(staffNow.onLeave.length, "on leave")} · ${staffNow.pending.length} pending`}
        />
        <Stat
          href="/admissions"
          label={`Admissions ${ay.nextLabel}`}
          value={number(adm.funnel[0].count)}
          sub={`enquiries · ${adm.funnel[3].count} offers · ${adm.funnel[4].count} enrolled`}
        />
      </div>

      {/* Attendance trend + attention */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Attendance, last 30 school days"
            description="Share of students present or late, whole school"
            action={<ButtonLink href="/attendance" variant="ghost" size="sm">Details <ArrowRight /></ButtonLink>}
          />
          <CardBody>
            <LineChart
              ariaLabel="School attendance over the last 30 school days"
              labels={att.trend.map((d) => fmtWeekday(d.date))}
              tickLabel={(i) => (i % 5 === 0 || i === att.trend.length - 1 ? fmtDay(att.trend[i].date) : null)}
              series={[{ id: "att", label: "Present", color: SERIES.s1, values: att.trend.map((d) => d.rate) }]}
              yDomain={[0.85, 0.98]}
              yFormat={(n) => `${Math.round(n * 100)}%`}
              valueFormat={(n) => percent(n)}
              target={{ value: 0.92, label: "Target 92%" }}
              area
              endLabel
              height={232}
            />
            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
              {[
                { k: "Present", v: att.today.present, tone: "bg-good" },
                { k: "Late", v: att.today.late, tone: "bg-[#D9961F]" },
                { k: "Absent", v: att.today.absent, tone: "bg-bad" },
                { k: "On leave", v: att.today.leave, tone: "bg-info" },
                { k: "Not marked", v: att.today.unmarked, tone: "bg-faint" },
              ].map((x) => (
                <div key={x.k} className="bg-surface px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                    <span className={cn("size-1.5 rounded-full", x.tone)} />
                    {x.k}
                  </dt>
                  <dd className="tnum mt-1 text-[18px] font-semibold text-ink">{number(x.v)}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Needs your attention" icon={<AlertTriangle />} />
          <ul className="divide-y divide-line border-t border-line">
            {unmarked.length > 0 && (
              <Attention
                tone="warn"
                icon={<ClipboardCheck />}
                title={`${unmarked.map((u) => u.label).join(", ")} register not marked`}
                body="Registers close at 9:30 am. The class teacher has been reminded once."
                action={
                  <Button size="sm" variant="secondary" onClick={() => toast({ title: "Reminder sent", body: "Ms. Kavya Iyer will get a push notification and SMS." })}>
                    Nudge teacher
                  </Button>
                }
              />
            )}
            <Attention
              tone="bad"
              icon={<IndianRupee />}
              title={`${plural(fees.defaulters.length, "family", "families")} overdue on fees`}
              body={`${rupees(fees.overdue)} is past its due date.`}
              action={<ButtonLink href="/fees?tab=overdue" size="sm" variant="secondary">Review</ButtonLink>}
            />
            {atRisk.length > 0 && (
              <Attention
                tone="bad"
                icon={<AlertTriangle />}
                title={`${plural(atRisk.length, "board student")} under 75% attendance`}
                body={`Classes X & XII — CBSE requires 75% to sit the board exams. ${atRisk.slice(0, 2).map((x) => x.s.firstName).join(", ")}…`}
                action={<ButtonLink href="/attendance?view=risk" size="sm" variant="secondary">See list</ButtonLink>}
              />
            )}
            {staffNow.pending.length > 0 && (
              <Attention
                tone="info"
                icon={<UsersRound />}
                title={`${plural(staffNow.pending.length, "leave request")} to approve`}
                body={staffNow.pending.slice(0, 3).map((l) => `${l.staff.title} ${l.staff.lastName}`).join(", ")}
                action={<ButtonLink href="/staff?tab=leave" size="sm" variant="secondary">Review</ButtonLink>}
              />
            )}
            {lowest && lowest.rate < 0.88 && (
              <Attention
                tone="warn"
                icon={<ClipboardCheck />}
                title={`${lowest.label} at ${percent(lowest.rate, 0)} today`}
                body={`${lowest.absent + lowest.leave} of ${lowest.total} absent — lowest in school.`}
              />
            )}
            {lateBus && (
              <Attention tone="warn" icon={<Bus />} title={`Bus ${lateBus.r.id} running ${lateBus.s.delay} min late`} body={`${lateBus.r.name} · ${lateBus.r.bus}. Parents on the route have been notified.`} />
            )}
          </ul>
        </Card>
      </div>

      {/* Class grid + staff/events */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={`Class-wise attendance · ${fmtWeekday(day)}`}
            description="Tap a class to open its register"
            action={<Legend items={ATTENDANCE_BINS.map((b) => ({ label: b.label, color: b.bg }))} className="hidden md:flex" />}
          />
          <CardBody>
            <Heatmap
              columns={["A", "B", "C", "D"]}
              rows={GRADES.map((g) => ({
                label: g.short === "Nur" ? "Nursery" : g.short,
                cells: ["A", "B", "C", "D"].map((sec) => {
                  if (!g.sections.includes(sec)) return null;
                  const cell = att.grid.find((x) => x.key === `${g.id}-${sec}`)!;
                  const marked = isMarked(cell.key, day);
                  return {
                    key: cell.key,
                    value: marked ? cell.rate : null,
                    display: marked ? `${Math.round(cell.rate * 100)}%` : "Not marked",
                    detail: marked ? (
                      <div>
                        <div className="text-[11px] text-white/60">{classLabel(g.id, sec)}</div>
                        <div>
                          <span className="font-semibold">{percent(cell.rate)}</span> present · {cell.absent} absent{cell.leave ? ` · ${cell.leave} on leave` : ""}
                        </div>
                      </div>
                    ) : (
                      `${classLabel(g.id, sec)} — register not marked yet`
                    ),
                  };
                }),
              }))}
              tone={attendanceTone}
              onCell={(key) => router.push(`/attendance?class=${key}`)}
            />
            <Legend items={ATTENDANCE_BINS.map((b) => ({ label: b.label, color: b.bg }))} className="mt-4 md:hidden" />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Coming up" icon={<CalendarClock />} action={<ButtonLink href="/calendar" variant="ghost" size="sm">Calendar</ButtonLink>} />
            <ul className="px-5 pb-4">
              {upcomingEvents(5).map((e) => (
                <li key={e.id} className="flex gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                  <div className={cn("flex w-11 shrink-0 flex-col items-center rounded-lg py-1", e.kind === "Holiday" ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand")}>
                    <span className="text-[10px] font-semibold uppercase">{fmtMonth(e.date)}</span>
                    <span className="tnum text-[16px] leading-tight font-semibold">{e.date.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{e.title}</p>
                    <p className="truncate text-[12px] text-muted">
                      {relativeDays(e.date, new Date())}
                      {e.time ? ` · ${e.time}` : ""} · {e.audience}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="On leave today" description={`${staffNow.onLeave.length} of ${staffNow.presence.total} staff`} />
            <ul className="px-5 pb-4">
              {staffNow.onLeave.map((l) => (
                <li key={l.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                  <Avatar name={l.staff.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{`${l.staff.title} ${l.staff.name}`}</p>
                    <p className="truncate text-[12px] text-muted">{l.substitute ? `Cover: ${l.substitute}` : l.staff.designation}</p>
                  </div>
                  <Badge tone="neutral">{l.type}</Badge>
                </li>
              ))}
              {staffNow.onLeave.length === 0 && <li className="py-2 text-[13px] text-muted">Everyone is in today.</li>}
            </ul>
          </Card>
        </div>
      </div>

      {/* Fees */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Fee collection by instalment"
            description={`Tuition and transport, quarterly instalments · AY ${ay.label}`}
            action={<ButtonLink href="/fees" variant="ghost" size="sm">Fees <ArrowRight /></ButtonLink>}
          />
          <CardBody>
            <Legend
              className="mb-4"
              items={[
                { label: "Collected", color: SERIES.s1 },
                { label: "Overdue", color: SERIES.s4 },
                { label: "Due, not yet late", color: SERIES.s2 },
                { label: "Not yet billed", color: SERIES.muted },
              ]}
            />
            <ColumnChart
              ariaLabel="Fees collected, overdue, due and not yet billed for each quarterly instalment"
              categories={fees.byInstalment.map((b) => `${b.id} · ${b.covers}`)}
              series={[
                { id: "paid", label: "Collected", color: SERIES.s1, values: fees.byInstalment.map((b) => b.paid) },
                { id: "overdue", label: "Overdue", color: SERIES.s4, values: fees.byInstalment.map((b) => b.overdue) },
                { id: "open", label: "Due, not yet late", color: SERIES.s2, values: fees.byInstalment.map((b) => b.open) },
                { id: "upcoming", label: "Not yet billed", color: SERIES.muted, values: fees.byInstalment.map((b) => b.upcoming) },
              ]}
              stacked
              maxBar={56}
              yFormat={(n) => rupeesCompact(n, 0)}
              valueFormat={(n) => rupeesCompact(n)}
              height={232}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="How families pay" description="Share of fees collected this year" />
          <CardBody>
            <div className="mb-5 flex items-baseline gap-2">
              <span className="text-[26px] font-semibold tracking-[-0.02em]">{percent((fees.modes.UPI + fees.modes["Net banking"] + fees.modes.Card) / (fees.collected || 1), 0)}</span>
              <span className="text-[12.5px] text-muted">paid online — no queue at the accounts window</span>
            </div>
            <StackedBar
              segments={PAYMENT_MODES.map((m, i) => ({ label: m, value: fees.modes[m], color: [SERIES.s1, SERIES.s3, SERIES.s2, SERIES.s4, "#9A968C"][i] }))}
              format={(n) => rupeesCompact(n)}
              columns={1}
            />
          </CardBody>
        </Card>
      </div>

      {/* Academics + admissions + notices */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Class averages" description={`${exam.name}, all sections`} action={<ButtonLink href="/academics" variant="ghost" size="sm">Results</ButtonLink>} />
          <CardBody>
            <BarList rows={classAverages.map((c) => ({ id: c.id, label: c.label, value: c.value }))} max={100} format={(n) => `${n.toFixed(1)}%`} labelWidth={76} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top performers" description={`${exam.short} · Classes X & XII`} />
          <ol className="px-5 pb-4">
            {toppers().map((r, i) => (
              <li key={r.student.id}>
                <Link href={`/students/${r.student.id}`} className="-mx-2 flex items-center gap-3 rounded-lg border-t border-line px-2 py-2.5 hover:bg-surface-2">
                  <span className="tnum w-4 text-[12px] font-semibold text-muted">{i + 1}</span>
                  <Avatar name={r.student.name} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{r.student.name}</span>
                    <span className="block text-[12px] text-muted">{classLabel(r.student.grade, r.student.section)}</span>
                  </span>
                  <span className="tnum text-[13px] font-semibold">{r.pct.toFixed(1)}%</span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="px-5 pb-5">
            <AdmissionsMini funnel={adm.funnel} />
          </div>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Latest notices" action={<ButtonLink href="/notices" variant="ghost" size="sm">All notices</ButtonLink>} />
          <ul className="px-5 pb-4">
            {notices()
              .slice(0, 4)
              .map((n) => (
                <li key={n.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2 text-[11.5px] text-muted">
                    <Badge tone={n.category === "Fees" ? "warn" : n.category === "Health & safety" ? "bad" : n.category === "Transport" ? "info" : "brand"}>{n.category}</Badge>
                    <span>{relativeDays(n.postedAt, new Date())}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug font-medium text-ink">{n.title}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <Meter value={n.reach.read / n.reach.total} className="flex-1" label="Read rate" />
                    <span className="tnum shrink-0 text-[11.5px] whitespace-nowrap text-muted">
                      Read by {number(n.reach.read)} of {number(n.reach.total)}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Attention({ tone, icon, title, body, action }: { tone: "bad" | "warn" | "info"; icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <li className="flex gap-3 px-5 py-3.5">
      <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg [&_svg]:size-3.5", { bad: "bg-bad-soft text-bad", warn: "bg-warn-soft text-warn", info: "bg-info-soft text-info" }[tone])}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted">{body}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </li>
  );
}

function AdmissionsMini({ funnel }: { funnel: { stage: string; count: number }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <UserPlus className="size-4 text-muted" /> Admissions pipeline
        </span>
        <Link href="/admissions" className="text-[12px] font-medium text-brand hover:underline">
          Open
        </Link>
      </div>
      <Funnel stages={funnel.map((f) => ({ label: f.stage, count: f.count }))} />
    </div>
  );
}
