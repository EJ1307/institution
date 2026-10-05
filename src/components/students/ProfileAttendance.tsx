"use client";

import { CalendarCheck2 } from "lucide-react";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { Legend, SERIES } from "@/components/charts/misc";
import { Segmented } from "@/components/ui/forms";
import { EmptyState } from "@/components/ui/layout";
import { Badge, Card, CardBody, CardHeader, cn } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { currentSchoolDay, studentSummary, type Mark } from "@/lib/data/attendance";
import { academicYear, schoolDaysBetween } from "@/lib/data/calendar";
import type { Student } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { fmtMonth, fmtMonthYear, fmtWeekday, percent } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { CalendarLegend, MARK_STYLE, MonthCalendar } from "./MonthCalendar";
import { classRate, markNote, marksIn, monthsOfYear } from "./profileData";
import { SummaryCell, SummaryStrip } from "./shared";

const TONE: Record<Exclude<Mark, "P">, "bad" | "warn" | "info"> = { A: "bad", L: "warn", E: "info" };

export function ProfileAttendance({ student: s }: { student: Student }) {
  const store = useAppState((st) => st.attendance);
  const day = currentSchoolDay();
  const ay = academicYear(day);
  const [filter, setFilter] = useState<"all" | "A" | "E" | "L">("all");

  const data = useMemo(() => {
    const days = schoolDaysBetween(ay.start, day);
    const sum = studentSummary(s, days);
    const cls = classRate(s.classKey, days);
    const months = monthsOfYear(s, ay.start, day);
    const log = marksIn(s, days).reverse();
    return { days, sum, cls, months, log };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, store, day.getTime()]);

  const chartMonths = data.months.filter((m) => m.days.length > 0);
  const rows = data.log.filter((x) => filter === "all" || x.m === filter);
  const label = classLabel(s.grade, s.section);
  const diff = (data.sum.rate - data.cls) * 100;
  const lowest = [...chartMonths].sort((a, b) => a.rate - b.rate)[0];
  const minRate = Math.min(...chartMonths.map((m) => Math.min(m.rate, m.classRate)));
  const showTarget = minRate < 0.85;
  const yLo = showTarget ? Math.min(0.7, Math.floor(minRate * 20) / 20) : Math.floor(minRate * 20) / 20 - 0.05;

  return (
    <div className="flex flex-col gap-4">
      <SummaryStrip className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCell label="Attendance rate" value={percent(data.sum.rate)} sub={`${data.days.length} school days`} />
        <SummaryCell
          label={`${label} average`}
          value={percent(data.cls)}
          sub={<span className={diff >= 0 ? "text-good" : "text-bad"}>{`${diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} pts for ${s.firstName}`}</span>}
        />
        <SummaryCell label="Days present" value={data.sum.present + data.sum.late} sub={`incl. ${data.sum.late} late arrivals`} />
        <SummaryCell label="Absent" value={data.sum.absent} sub="without leave" />
        <SummaryCell label="On leave" value={data.sum.leave} sub="applied by parents" />
        <SummaryCell label="Lowest month" value={lowest ? fmtMonth(lowest.month) : "—"} sub={lowest ? percent(lowest.rate) : undefined} />
      </SummaryStrip>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Month by month" description={`${s.firstName} compared with the ${label} average`} />
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
              ariaLabel={`Monthly attendance for ${s.name} compared with the class average`}
              labels={chartMonths.map((m) => fmtMonthYear(m.month))}
              tickLabel={(i) => fmtMonth(chartMonths[i].month)}
              series={[
                { id: "me", label: s.firstName, color: SERIES.s1, values: chartMonths.map((m) => m.rate) },
                { id: "cls", label: `${label} average`, color: SERIES.s2, values: chartMonths.map((m) => m.classRate) },
              ]}
              yDomain={[yLo, 1]}
              yFormat={(n) => `${Math.round(n * 100)}%`}
              valueFormat={(n) => percent(n)}
              target={showTarget ? { value: 0.75, label: "CBSE minimum 75%" } : undefined}
              height={232}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Months" description="Summer vacation and holidays excluded" />
          <ul className="px-5 pb-4">
            {data.months.map((m) => (
              <li key={m.month.getTime()} className="flex items-center gap-3 border-t border-line py-2.5 text-[13px] first:border-t-0 first:pt-0">
                <span className="w-10 font-medium text-ink">{fmtMonth(m.month)}</span>
                {m.days.length ? (
                  <>
                    <span className="tnum flex-1 text-[12px] whitespace-nowrap text-muted">{m.days.length} days</span>
                    <span className="flex gap-1">
                      {m.absent > 0 && <Badge tone="bad">{m.absent} absent</Badge>}
                      {m.leave > 0 && <Badge tone="info">{m.leave} leave</Badge>}
                      {m.late > 0 && <Badge tone="warn">{m.late} late</Badge>}
                    </span>
                    <span className={cn("tnum w-14 text-right font-semibold", m.rate < 0.85 ? "text-bad" : "text-ink")}>{percent(m.rate)}</span>
                  </>
                ) : (
                  <span className="flex-1 text-[12px] text-muted">Summer vacation</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Register, day by day" description={`Every school day from ${fmtWeekday(ay.start)} to ${fmtWeekday(day)}`} action={<CalendarLegend className="hidden lg:flex" />} />
        <CardBody>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {data.months.map((m) => (
              <MonthCalendar
                key={m.month.getTime()}
                student={s}
                month={m.month}
                today={day}
                size="sm"
                title={
                  <span className="flex items-baseline justify-between gap-2">
                    {fmtMonthYear(m.month)}
                    <span className="tnum text-[11.5px] font-normal text-muted">{m.days.length ? percent(m.rate) : "Summer vacation"}</span>
                  </span>
                }
              />
            ))}
          </div>
          <CalendarLegend className="mt-5 lg:hidden" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Absences, leave and late arrivals"
          description={`${data.log.length} entries this year`}
          action={
            <Segmented
              size="sm"
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All", count: data.log.length },
                { value: "A", label: "Absent", count: data.sum.absent },
                { value: "E", label: "Leave", count: data.sum.leave },
                { value: "L", label: "Late", count: data.sum.late },
              ]}
              className="hidden sm:inline-flex"
            />
          }
        />
        {rows.length === 0 ? (
          <EmptyState icon={<CalendarCheck2 />} title="Nothing to show" body={`${s.firstName} has a clean record for this filter.`} className="border-t border-line py-10" />
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Date</Th>
                <Th>Mark</Th>
                <Th>Note</Th>
              </tr>
            </THead>
            <tbody>
              {rows.slice(0, 40).map(({ d, m }) => (
                <Tr key={d.getTime()}>
                  <Td className="tnum whitespace-nowrap text-ink">{fmtWeekday(d)}</Td>
                  <Td>
                    <Badge tone={TONE[m as Exclude<Mark, "P">]} dot>
                      {MARK_STYLE[m].label}
                    </Badge>
                  </Td>
                  <Td className="text-ink-2">{markNote(s, d, m)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
