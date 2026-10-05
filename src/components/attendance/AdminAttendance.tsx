"use client";

import { AlertTriangle, ArrowRight, Download, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ATTENDANCE_BINS, attendanceTone, Heatmap } from "@/components/charts/Heatmap";
import { LineChart } from "@/components/charts/LineChart";
import { Legend, SERIES, Sparkline, StackedBar } from "@/components/charts/misc";
import { Segmented } from "@/components/ui/forms";
import { PageHeader, Stat } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, ButtonLink, Card, CardBody, CardHeader, cn, Delta } from "@/components/ui/primitives";
import { currentSchoolDay, isMarked, leaveRequests, markFor, staffOnLeave, staffPresence } from "@/lib/data/attendance";
import { academicYear, isoDate, schoolDaysBack } from "@/lib/data/calendar";
import { classTeacher, students } from "@/lib/data/people";
import { CLASSES, classLabel, GRADE_BY_ID, GRADES, type Stage } from "@/lib/data/school";
import { fmtDay, fmtMonth, fmtWeekday, fmtWeekdayLong, number, percent, plural } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { ClassRegister } from "./ClassRegister";
import { RiskList } from "./RiskList";
import { awayStreak, parseDay, SchoolDayPicker, schoolTrendCached, sumCounts, termSummaryCached, useWide } from "./shared";

export function AdminAttendance() {
  const params = useSearchParams();
  const classKey = params.get("class");
  const view = params.get("view");
  const day = parseDay(params.get("date"));
  if (classKey && CLASSES.some((c) => c.key === classKey)) return <ClassRegister classKey={classKey} day={day} />;
  if (view === "risk") return <RiskList />;
  return <Overview day={day} />;
}

const STAGES: { stage: Stage; range: string }[] = [
  { stage: "Pre-primary", range: "Nursery – UKG" },
  { stage: "Primary", range: "Classes I – V" },
  { stage: "Middle", range: "Classes VI – VIII" },
  { stage: "Secondary", range: "Classes IX – X" },
  { stage: "Senior secondary", range: "Classes XI – XII" },
];

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
] as const;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function Overview({ day }: { day: Date }) {
  const router = useRouter();
  const toast = useToast();
  const attendanceStore = useAppState((s) => s.attendance);
  const leaveStore = useAppState((s) => s.leaveDecisions);
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const wide = useWide();

  const today = currentSchoolDay();
  const iso = isoDate(day);
  const todayIso = isoDate(today);
  const isToday = iso === todayIso;
  const ay = academicYear(today);

  const setDay = (d: Date) => router.replace(isoDate(d) === todayIso ? "/attendance" : `/attendance?date=${isoDate(d)}`, { scroll: false });

  // 20 school days ending on the selected day: KPI delta, sparklines, stage averages
  const base = useMemo(() => schoolTrendCached(21, day), [iso, attendanceStore]);
  const trend = useMemo(() => schoolTrendCached(Number(range), day), [range, iso, attendanceStore]);
  const dayRow = base[base.length - 1];
  const prior = base.slice(0, -1);
  const priorAvg = avg(prior.map((r) => r.rate));
  const grid = dayRow.grid;
  const unmarked = grid.filter((g) => !isMarked(g.key, day));

  const stages = useMemo(
    () =>
      STAGES.map(({ stage, range: r }) => {
        const inStage = (key: string) => GRADE_BY_ID[CLASSES.find((c) => c.key === key)!.grade].stage === stage;
        const series = base.map((b) => sumCounts(b.grid.filter((g) => inStage(g.key))));
        const now = series[series.length - 1];
        return { stage, range: r, now, avg: avg(series.slice(0, -1).map((x) => x.rate)), spark: series.map((x) => x.rate), students: now.total };
      }),
    [base],
  );

  const weekdays = useMemo(() => {
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const rows = names.map((n, i) => {
      const xs = trend.filter((t) => t.date.getDay() === i + 1 && t.total - t.unmarked > 0).map((t) => t.rate);
      return { n, rate: xs.length ? avg(xs) : null };
    });
    const valid = rows.filter((r) => r.rate !== null) as { n: string; rate: number }[];
    const lowest = valid.length > 1 ? valid.reduce((a, b) => (b.rate < a.rate ? b : a)).n : null;
    return { rows, lowest };
  }, [trend]);

  const staffNow = useMemo(
    () => ({ presence: staffPresence(day), onLeave: staffOnLeave(day), pending: leaveRequests().filter((l) => l.status === "pending") }),
    [iso, leaveStore],
  );

  const term = useMemo(() => {
    const list = students().map((s) => ({ s, sum: termSummaryCached(s, today) }));
    const below = list.filter((x) => x.sum.rate < 0.75);
    return {
      below: below.length,
      board: below.filter((x) => x.s.grade === "10" || x.s.grade === "12").length,
      watch: list.filter((x) => x.sum.rate >= 0.75 && x.sum.rate < 0.85).length,
      rate: sumCounts(list.map((x) => x.sum)).rate,
    };
  }, [todayIso, attendanceStore]);

  // students away (absent or on leave) on 3+ of the last 10 school days, and away on the selected day
  const away = useMemo(() => {
    const window10 = schoolDaysBack(10, day);
    return students()
      .filter((s) => {
        const m = markFor(s, day);
        return m === "A" || m === "E";
      })
      .map((s) => {
        const marks = window10.map((d) => markFor(s, d));
        return { s, count: marks.filter((m) => m === "A" || m === "E").length, streak: awayStreak(s, day).days };
      })
      .filter((x) => x.count >= 3)
      .sort((a, b) => b.count - a.count || b.streak - a.streak);
  }, [iso, attendanceStore]);

  const n = trend.length;
  const tick = (i: number) => {
    if (n <= 7) return fmtWeekday(trend[i].date).split(",")[0];
    if (n <= 30) {
      const every = wide ? 5 : 10;
      return i === n - 1 ? fmtDay(trend[i].date) : i % every === 0 && i < n - every / 2 ? fmtDay(trend[i].date) : null;
    }
    const d = trend[i].date;
    const prev = i > 0 ? trend[i - 1].date : null;
    const monthStart = (!prev || prev.getMonth() !== d.getMonth()) && i < n - 6;
    if (!monthStart) return i === n - 1 ? fmtDay(d) : null;
    return wide || d.getMonth() % 2 === 0 ? (wide ? fmtDay(d) : fmtMonth(d)) : null;
  };
  const rates = trend.filter((t) => t.total - t.unmarked > 0).map((t) => t.rate);
  const yLo = Math.min(0.86, Math.floor((Math.min(...rates) - 0.01) * 50) / 50);
  const yHi = Math.max(0.97, Math.ceil((Math.max(...rates) + 0.005) * 50) / 50);
  const dayLabel = isToday ? "today" : fmtWeekday(day);

  return (
    <>
      <PageHeader
        eyebrow={`${fmtWeekdayLong(day)}${isToday ? " · Today" : ""} · AY ${ay.label}`}
        title="Attendance"
        description={
          isToday
            ? "Registers close at 9:30 am. Parents of students marked absent get an SMS at 10:00 am."
            : `Registers as submitted on ${fmtWeekdayLong(day)}.`
        }
        actions={
          <>
            {!isToday && (
              <Button variant="ghost" onClick={() => setDay(today)}>
                Back to today
              </Button>
            )}
            <SchoolDayPicker value={day} onChange={setDay} min={ay.start} max={today} />
            <Button
              variant="secondary"
              onClick={() =>
                toast({ title: `Attendance for ${fmtWeekday(day)} is downloading`, body: `${CLASSES.length} class registers, one sheet per class (.xlsx).`, tone: "info" })
              }
            >
              <Download /> Export
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={`Students present ${dayLabel}`}
          value={percent(dayRow.rate)}
          delta={<Delta value={(dayRow.rate - priorAvg) * 100} format={(x) => `${x.toFixed(1)} pts`} suffix="vs 4-wk avg" />}
          trend={<Sparkline values={base.map((b) => b.rate)} />}
        />
        <Stat
          label={`Away ${dayLabel}`}
          value={number(dayRow.absent + dayRow.leave)}
          sub={
            <span className="tnum">
              {number(dayRow.absent)} absent · {number(dayRow.leave)} on approved leave · {number(dayRow.late)} late
            </span>
          }
        />
        <Stat
          label="Registers submitted"
          value={
            <span className="tnum">
              {CLASSES.length - unmarked.length}
              <span className="text-[16px] font-medium text-muted">/{CLASSES.length}</span>
            </span>
          }
          sub={
            unmarked.length ? (
              <span>
                <span className="font-medium text-warn">{unmarked.map((u) => u.label).join(", ")} pending</span> · closes 9:30 am
              </span>
            ) : (
              "Every class is in"
            )
          }
        />
        <Stat
          href="/attendance?view=risk"
          label="Below 75% this term"
          value={number(term.below)}
          sub={`${term.board} in Classes X & XII · ${term.watch} more under 85%`}
          icon={<ArrowRight />}
        />
      </div>

      {/* Trend + by stage */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Whole-school attendance"
            description={`Share of students present or late, last ${range} school days to ${fmtDay(day)}`}
            action={<Segmented size="sm" label="Range" className="hidden sm:inline-flex" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />}
          />
          <CardBody>
            <Segmented size="sm" label="Range" className="mb-3 sm:hidden" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
            <LineChart
              ariaLabel={`School attendance over the last ${range} school days`}
              labels={trend.map((d) => fmtWeekday(d.date))}
              tickLabel={tick}
              series={[{ id: "att", label: "Present", color: SERIES.s1, values: trend.map((d) => (d.total - d.unmarked > 0 ? d.rate : null)) }]}
              yDomain={[yLo, yHi]}
              yFormat={(v) => `${Math.round(v * 100)}%`}
              valueFormat={(v) => percent(v)}
              target={{ value: 0.92, label: "Target 92%" }}
              area
              endLabel
              height={240}
            />
            <div className="mt-5">
              <p className="mb-2 text-[12px] font-medium text-muted">Average by weekday, same period</p>
              <dl className="grid grid-cols-5 gap-px overflow-hidden rounded-xl border border-line bg-line">
                {weekdays.rows.map((w) => (
                  <div key={w.n} className="bg-surface px-3 py-2.5 sm:px-4">
                    <dt className="flex items-center gap-1.5 text-[12px] text-muted">
                      {w.n}
                      {weekdays.lowest === w.n && <span className="hidden rounded bg-warn-soft px-1 text-[10.5px] font-medium text-warn sm:inline">Lowest</span>}
                    </dt>
                    <dd className={cn("tnum mt-0.5 text-[16px] font-semibold", weekdays.lowest === w.n ? "text-warn" : "text-ink")}>{w.rate === null ? "—" : percent(w.rate)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By stage" description={`${fmtWeekday(day)} vs the previous 20 school days`} />
          <ul className="border-t border-line">
            {stages.map((st) => (
              <li key={st.stage} className="grid grid-cols-[minmax(0,1fr)_72px_auto] items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{st.stage}</p>
                  <p className="truncate text-[12px] text-muted">
                    {st.range} · {number(st.students)}
                  </p>
                </div>
                <Sparkline values={st.spark} height={26} />
                <div className="text-right">
                  <p className="tnum text-[15px] font-semibold text-ink">{st.now.total - st.now.unmarked ? percent(st.now.rate) : "—"}</p>
                  <Delta value={(st.now.rate - st.avg) * 100} format={(x) => `${x.toFixed(1)} pts`} />
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-[12px] text-muted">
            Term to date, the school is at <span className="tnum font-semibold text-ink">{percent(term.rate)}</span> since 1 April.
          </p>
        </Card>
      </div>

      {/* Heatmap + staff + streaks */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={`Class-wise attendance · ${fmtWeekday(day)}`}
            description="Select a class to open its register"
            action={<Legend items={ATTENDANCE_BINS.map((b) => ({ label: b.label, color: b.bg }))} className="hidden md:flex" />}
          />
          <CardBody>
            <Heatmap
              columns={["A", "B", "C", "D"]}
              rows={GRADES.map((g) => ({
                label: g.short === "Nur" ? "Nursery" : g.short,
                cells: ["A", "B", "C", "D"].map((sec) => {
                  if (!g.sections.includes(sec)) return null;
                  const cell = grid.find((x) => x.key === `${g.id}-${sec}`)!;
                  const marked = isMarked(cell.key, day);
                  return {
                    key: cell.key,
                    value: marked ? cell.rate : null,
                    display: marked ? `${Math.round(cell.rate * 100)}%` : "Not marked",
                    detail: marked ? (
                      <div>
                        <div className="text-[11px] text-white/60">
                          {classLabel(g.id, sec)} · {classTeacher(cell.key)?.name ?? "—"}
                        </div>
                        <div>
                          <span className="font-semibold">{percent(cell.rate)}</span> present · {cell.absent} absent{cell.leave ? ` · ${cell.leave} on leave` : ""}
                          {cell.late ? ` · ${cell.late} late` : ""}
                        </div>
                      </div>
                    ) : (
                      `${classLabel(g.id, sec)} — register not submitted yet`
                    ),
                  };
                }),
              }))}
              tone={attendanceTone}
              onCell={(key) => router.push(`/attendance?class=${key}${isToday ? "" : `&date=${iso}`}`)}
            />
            <Legend items={ATTENDANCE_BINS.map((b) => ({ label: b.label, color: b.bg }))} className="mt-4 md:hidden" />
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Staff presence"
              description={`Biometric check-in, ${fmtWeekday(day)}`}
              action={<ButtonLink href="/staff?tab=leave" variant="ghost" size="sm">Leave <ArrowRight /></ButtonLink>}
            />
            <CardBody>
              <div className="mb-4 flex items-baseline gap-2">
                <span className="tnum text-[26px] leading-none font-semibold tracking-[-0.02em]">
                  {staffNow.presence.present}
                  <span className="text-[16px] font-medium text-muted">/{staffNow.presence.total}</span>
                </span>
                <span className="text-[12.5px] text-muted">in school · {plural(staffNow.pending.length, "leave request")} pending</span>
              </div>
              <StackedBar
                columns={1}
                format={(x) => number(x)}
                segments={[
                  { label: "On time (by 7:45 am)", value: staffNow.presence.present - staffNow.presence.late, color: SERIES.s1 },
                  { label: "Late check-in", value: staffNow.presence.late, color: SERIES.s2 },
                  { label: "On leave", value: staffNow.presence.onLeave, color: SERIES.muted },
                ]}
              />
            </CardBody>
            <ul className="border-t border-line px-5 py-1">
              {staffNow.onLeave.map((l) => (
                <li key={l.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                  <Avatar name={l.staff.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{`${l.staff.title} ${l.staff.name}`}</p>
                    <p className="truncate text-[12px] text-muted">{l.substitute ? `Cover: ${l.substitute}` : l.staff.designation}</p>
                  </div>
                  <Badge>{l.type}</Badge>
                </li>
              ))}
              {staffNow.onLeave.length === 0 && <li className="py-3 text-[13px] text-muted">Everyone is in.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Frequently away"
              icon={<AlertTriangle />}
              description={`Away ${isToday ? "today" : `on ${fmtWeekday(day)}`} and on 3+ of the last 10 school days. Class teachers call home; the counsellor follows up.`}
            />
            {away.length ? (
              <ul className="border-t border-line px-5 py-1">
                {away.slice(0, 6).map(({ s, count, streak }) => {
                  const g = s.guardians[0];
                  return (
                    <li key={s.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                      <Avatar name={s.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/students/${s.id}`} className="block truncate text-[13px] font-medium hover:underline">
                          {s.name}
                        </Link>
                        <p className="truncate text-[12px] text-muted">
                          {classLabel(s.grade, s.section)} · {streak > 1 ? `${streak} days in a row` : `${s.guardians[0].relation}: ${s.guardians[0].name.split(" ")[0]}`}
                        </p>
                      </div>
                      <Badge tone={count >= 5 ? "bad" : "warn"}>
                        <span className="tnum">{count} of 10</span>
                      </Badge>
                      <a
                        href={`tel:${g.phone.replace(/\s/g, "")}`}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink"
                        aria-label={`Call ${g.name}, ${g.relation.toLowerCase()} of ${s.firstName}`}
                        title={`${g.name} · ${g.phone}`}
                      >
                        <Phone className="size-4" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t border-line px-5 py-4 text-[13px] text-muted">No student absent {isToday ? "today" : "that day"} has a pattern of absences.</p>
            )}
            {away.length > 6 && <p className="border-t border-line px-5 py-2.5 text-[12px] text-muted">and {away.length - 6} more</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
