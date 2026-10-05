"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/forms";
import { PageHeader } from "@/components/ui/layout";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardHeader, cn, Delta } from "@/components/ui/primitives";
import { currentSchoolDay, markFor, type Mark } from "@/lib/data/attendance";
import { academicYear, addDays, fromIso, holidayName, isoDate, isSchoolDay, isWeekend, nextSchoolDay, schoolDaysBack, schoolDaysBetween, today } from "@/lib/data/calendar";
import { classTeacher, studentsInClass } from "@/lib/data/people";
import { classLabelLong } from "@/lib/data/school";
import { fmtDay, fmtMonth, fmtMonthYear, fmtWeekday, fmtWeekdayLong, percent, plural, relativeDays } from "@/lib/format";
import { useChild } from "@/lib/session";
import { setState, useAppState, type StudentLeave } from "@/lib/store";
import { MARK_META, termSummaryCached } from "./shared";

type CellKind = Mark | "holiday" | "weekend" | "future" | "unmarked" | "outside";

const CELL: Record<CellKind, string> = {
  P: "bg-good-soft text-[#1D5A40]",
  L: "bg-warn-soft text-warn",
  A: "bg-bad-soft text-bad",
  E: "bg-info-soft text-info",
  holiday: "bg-[repeating-linear-gradient(135deg,var(--line)_0_1px,transparent_1px_6px)] text-muted",
  weekend: "text-faint",
  future: "text-ink-2",
  unmarked: "text-ink-2 border border-dashed border-line-strong",
  outside: "text-faint/60",
};

const LEAVE_REASONS = ["Unwell", "Medical appointment", "Family function", "Travel", "Religious observance", "Other"];

export function ParentAttendance() {
  const { child } = useChild();
  const toast = useToast();
  const attendanceStore = useAppState((s) => s.attendance);
  const leaveStore = useAppState((s) => s.studentLeave);
  const day = currentSchoolDay();
  const iso = isoDate(day);
  const ay = academicYear(day);
  const teacher = classTeacher(child.classKey);
  const teacherName = teacher ? `${teacher.title} ${teacher.name}` : "the class teacher";

  const [month, setMonth] = useState(() => new Date(day.getFullYear(), day.getMonth(), 1));
  const [picked, setPicked] = useState<Date | null>(null);
  const [apply, setApply] = useState<{ from: string; to: string } | null>(null);

  const myLeave = useMemo(() => leaveStore.filter((l) => l.studentId === child.id), [leaveStore, child.id]);
  const leaveOn = (d: Date) => {
    const x = isoDate(d);
    return myLeave.find((l) => l.from <= x && l.to >= x) ?? null;
  };

  const stats = useMemo(() => {
    const term = termSummaryCached(child, day);
    const mates = studentsInClass(child.classKey).map((s) => termSummaryCached(s, day).rate);
    const classAvg = mates.reduce((a, b) => a + b, 0) / (mates.length || 1);
    const rank = mates.filter((r) => r > term.rate).length;
    return { term, classAvg, betterThan: mates.length - rank - 1, classSize: mates.length };
  }, [child, iso, attendanceStore]);

  const recentAway = useMemo(
    () =>
      schoolDaysBack(80, day)
        .filter((d) => d >= ay.start)
        .map((d) => ({ d, m: markFor(child, d) }))
        .filter((x) => x.m && x.m !== "P")
        .reverse(),
    [child, iso, attendanceStore],
  );

  const months = useMemo(() => {
    const out: { m: Date; days: { d: Date; mark: Mark | null }[] }[] = [];
    for (let m = new Date(ay.start); m <= day; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
      const end = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      const days = schoolDaysBetween(m, end < day ? end : day).map((d) => ({ d, mark: markFor(child, d) }));
      out.push({ m, days });
    }
    return out;
  }, [child, iso, attendanceStore]);

  const todayMark = markFor(child, day);
  const isActualToday = isoDate(today()) === iso;

  // calendar cells for the visible month
  const cells = useMemo(() => {
    const lead = (month.getDay() + 6) % 7;
    const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: { d: Date | null; kind: CellKind; holiday?: string | null }[] = Array.from({ length: lead }, () => ({ d: null, kind: "outside" as const }));
    for (let i = 1; i <= daysIn; i++) {
      const d = new Date(month.getFullYear(), month.getMonth(), i);
      let kind: CellKind;
      const hol = holidayName(d);
      if (isWeekend(d)) kind = "weekend";
      else if (hol) kind = "holiday";
      else if (d < ay.start) kind = "outside";
      else if (d > day) kind = "future";
      else kind = markFor(child, d) ?? "unmarked";
      out.push({ d, kind, holiday: !isWeekend(d) ? hol : null });
    }
    return out;
  }, [month, child, iso, attendanceStore]);

  const monthCounts = useMemo(() => {
    const c = { P: 0, L: 0, A: 0, E: 0, holiday: 0 };
    for (const x of cells) if (x.kind in c) c[x.kind as keyof typeof c]++;
    return c;
  }, [cells]);

  const minMonth = new Date(ay.start.getFullYear(), ay.start.getMonth(), 1);
  const maxMonth = new Date(day.getFullYear(), day.getMonth() + 2, 1);
  const canPrev = month > minMonth;
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) < maxMonth;
  const shift = (n: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
    setPicked(null);
  };

  const pickedInfo = picked
    ? (() => {
        const hol = holidayName(picked);
        const lv = leaveOn(picked);
        if (isWeekend(picked)) return { title: fmtWeekdayLong(picked), body: "Weekend" };
        if (hol) return { title: fmtWeekdayLong(picked), body: `School holiday · ${hol}` };
        if (picked > day) return { title: fmtWeekdayLong(picked), body: lv ? `Leave applied — ${lv.reason}` : "Upcoming school day" };
        const m = markFor(child, picked);
        const note = lv ? ` · Leave note: ${lv.reason}` : "";
        if (!m) return { title: fmtWeekdayLong(picked), body: "Not marked yet — registers close at 9:30 am" };
        const time = m === "P" ? "Marked present by 8:55 am" : m === "L" ? "Reached after 8:00 am bell — marked late" : m === "A" ? "Marked absent" : "On approved leave";
        return { title: fmtWeekdayLong(picked), body: `${time}${note}` };
      })()
    : null;

  return (
    <>
      <PageHeader
        eyebrow={`${child.name} · ${classLabelLong(child.grade, child.section)}`}
        title="Attendance"
        description={`Marked by ${teacherName} before 9:30 am every school day. You'll get an SMS if ${child.firstName} is marked absent.`}
        actions={
          <Button variant="primary" onClick={() => setApply({ from: isoDate(nextSchoolDay(today())), to: isoDate(nextSchoolDay(today())) })}>
            <CalendarPlus /> Apply for leave
          </Button>
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        {/* Summary */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <p className="text-[12.5px] font-medium text-muted">This term · since 1 April</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="tnum text-[36px] leading-none font-semibold tracking-[-0.02em]">{percent(stats.term.rate)}</span>
              <Delta value={(stats.term.rate - stats.classAvg) * 100} format={(n) => `${n.toFixed(1)} pts`} suffix="vs class" />
            </div>
            <div className="relative mt-5 h-2 rounded-full bg-ink/[0.06]" aria-hidden>
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${stats.term.rate * 100}%` }} />
              <div className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-ink/60" style={{ left: `${stats.classAvg * 100}%` }} />
              <div className="absolute -top-1.5 -bottom-1.5 w-px bg-bad/70" style={{ left: "75%" }} />
            </div>
            <div className="mt-2 flex justify-between text-[11.5px] text-muted">
              <span>
                <span className="mr-1 inline-block h-2.5 w-0.5 translate-y-0.5 rounded-full bg-ink/60" />
                Class average {percent(stats.classAvg)}
              </span>
              <span>
                <span className="mr-1 inline-block h-2.5 w-px translate-y-0.5 bg-bad/70" />
                CBSE minimum 75%
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {(["P", "L", "A", "E"] as Mark[]).map((m) => (
                <div key={m} className="bg-surface px-2.5 py-2.5 text-center">
                  <dt className="truncate text-[11.5px] text-muted">{m === "E" ? "Leave" : MARK_META[m].label}</dt>
                  <dd className="tnum mt-0.5 text-[17px] font-semibold text-ink">{m === "P" ? stats.term.present : m === "L" ? stats.term.late : m === "A" ? stats.term.absent : stats.term.leave}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12.5px] text-muted">
              In school {stats.term.present + stats.term.late} of {stats.term.total - stats.term.unmarked} school days.
            </p>
          </Card>

          <Card className="flex items-center gap-3 px-5 py-4">
            <span className={cn("size-2.5 shrink-0 rounded-full", todayMark ? MARK_META[todayMark].dot : "border border-faint")} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-ink">
                {isActualToday ? "Today" : fmtWeekday(day)} · {todayMark ? (todayMark === "E" ? "On leave" : MARK_META[todayMark].label) : "Not marked yet"}
              </p>
              <p className="truncate text-[12px] text-muted">
                {todayMark === "P" ? `${child.firstName} was marked present at 8:52 am` : todayMark === "L" ? "Arrived after the 8:00 am bell" : todayMark === "A" ? "If this is unexpected, call the front office" : todayMark === "E" ? "Approved leave" : "Registers close at 9:30 am"}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Term at a glance" description="Each square is a school day" />
            <ul className="px-5 pb-4">
              {months.map(({ m, days }) => {
                const active = m.getMonth() === month.getMonth() && m.getFullYear() === month.getFullYear();
                const away = days.filter((x) => x.mark === "A" || x.mark === "E").length;
                return (
                  <li key={m.getTime()}>
                    <button
                      type="button"
                      onClick={() => (setMonth(new Date(m)), setPicked(null))}
                      aria-label={`Show ${fmtMonthYear(m)}`}
                      aria-current={active ? "true" : undefined}
                      className={cn("-mx-2 grid w-[calc(100%+16px)] grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2", active && "bg-surface-2")}
                    >
                      <span className={cn("text-[12px]", active ? "font-semibold text-ink" : "text-muted")}>{fmtMonth(m)}</span>
                      {days.length ? (
                        <span className="flex flex-wrap gap-[2px]">
                          {days.map(({ d, mark }) => (
                            <span key={d.getTime()} className={cn("size-[7px] rounded-[1.5px]", mark ? MARK_META[mark].dot : "border border-dashed border-line-strong", mark === "P" && "opacity-30")} />
                          ))}
                        </span>
                      ) : (
                        <span className="text-[12px] text-faint">Summer vacation</span>
                      )}
                      <span className="tnum text-right text-[11.5px] text-muted">{days.length ? `${away} away` : ""}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* Calendar */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <h2 className="text-[14px] font-semibold">{fmtMonthYear(month)}</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (setMonth(new Date(day.getFullYear(), day.getMonth(), 1)), setPicked(null))}
                disabled={month.getMonth() === day.getMonth() && month.getFullYear() === day.getFullYear()}
              >
                This month
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} disabled={!canNext} aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="px-3 sm:px-5">
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
                <div key={w} className="pb-1 text-center text-[11px] font-medium text-muted">
                  <span className="sm:hidden">{w[0]}</span>
                  <span className="hidden sm:inline">{w}</span>
                </div>
              ))}
              {cells.map((c, i) => {
                if (!c.d) return <div key={`e${i}`} />;
                const d = c.d;
                const isToday = isoDate(d) === iso && isActualToday;
                const lv = c.kind === "future" || c.kind === "A" || c.kind === "E" ? leaveOn(d) : null;
                const sel = picked && isoDate(picked) === isoDate(d);
                const label = `${fmtWeekdayLong(d)}: ${c.kind in MARK_META ? MARK_META[c.kind as Mark].label : c.kind === "holiday" ? `Holiday, ${c.holiday}` : c.kind === "weekend" ? "Weekend" : c.kind === "future" ? (lv ? "Leave applied" : "Upcoming") : c.kind === "unmarked" ? "Not marked" : "Before term"}`;
                return (
                  <button
                    key={d.getDate()}
                    type="button"
                    onClick={() => setPicked(sel ? null : d)}
                    aria-label={label}
                    aria-pressed={!!sel}
                    className={cn(
                      "relative flex h-11 flex-col items-start justify-between rounded-lg p-1.5 text-left transition-shadow sm:h-[60px] sm:p-2",
                      CELL[c.kind],
                      c.kind === "future" && lv && "border border-dashed border-info bg-info-soft/40 text-info",
                      isToday && "ring-2 ring-brand ring-offset-1 ring-offset-surface",
                      sel && "shadow-[inset_0_0_0_1.5px_var(--ink)]",
                    )}
                  >
                    <span className={cn("tnum text-[12.5px] leading-none font-semibold sm:text-[13px]", (c.kind === "weekend" || c.kind === "outside") && "font-normal")}>{d.getDate()}</span>
                    <span className="hidden w-full truncate text-[10.5px] leading-tight font-medium sm:block">
                      {c.kind === "holiday" ? c.holiday : c.kind === "L" ? "Late" : c.kind === "A" ? "Absent" : c.kind === "E" ? "Leave" : c.kind === "future" && lv ? "Leave" : ""}
                    </span>
                    {c.kind !== "weekend" && c.kind !== "outside" && c.kind !== "future" && c.kind !== "unmarked" && c.kind !== "holiday" && (
                      <span className={cn("absolute top-1.5 right-1.5 size-1.5 rounded-full sm:hidden", MARK_META[c.kind as Mark].dot, c.kind === "P" && "opacity-0")} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mx-5 mt-3 min-h-[44px] rounded-lg bg-surface-2 px-3.5 py-2.5 text-[12.5px]" aria-live="polite">
            {pickedInfo ? (
              <>
                <span className="font-medium text-ink">{pickedInfo.title}</span>
                <span className="text-muted"> · {pickedInfo.body}</span>
              </>
            ) : (
              <span className="text-muted">Tap a day to see how it was marked.</span>
            )}
          </div>

          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-3.5 pb-4 text-[12px] text-ink-2">
            {(["P", "L", "A", "E"] as Mark[]).map((m) => (
              <li key={m} className="flex items-center gap-1.5">
                <span className={cn("size-3 rounded-[4px]", CELL[m])} />
                {m === "E" ? "Leave" : MARK_META[m].label}
                <span className="tnum font-semibold text-ink">{monthCounts[m as keyof typeof monthCounts]}</span>
              </li>
            ))}
            <li className="flex items-center gap-1.5">
              <span className={cn("size-3 rounded-[4px] border border-line", CELL.holiday)} />
              Holiday <span className="tnum font-semibold text-ink">{monthCounts.holiday}</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded-[4px] border border-line bg-surface" />
              Weekend
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded-[4px] border border-dashed border-info bg-info-soft/40" />
              Leave applied
            </li>
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Absences and late arrivals" description={`This term · ${plural(recentAway.length, "day")}`} />
          {recentAway.length ? (
            <ul className="border-t border-line">
              {recentAway.slice(0, 10).map(({ d, m }) => {
                const lv = leaveOn(d);
                return (
                  <li key={d.getTime()} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                    <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-surface-2 py-1">
                      <span className="text-[10px] font-semibold text-muted uppercase">{fmtWeekday(d).split(",")[0]}</span>
                      <span className="tnum text-[15px] leading-tight font-semibold">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">{fmtDay(d)}</p>
                      <p className="truncate text-[12px] text-muted">
                        {lv ? `Reason sent: ${lv.reason}${lv.details ? ` — ${lv.details}` : ""}` : m === "L" ? "Arrived after the 8:00 am bell" : m === "E" ? "Approved leave" : "No reason on record"}
                      </p>
                    </div>
                    <Badge tone={m === "A" ? "bad" : m === "L" ? "warn" : "info"} dot>
                      {m === "E" ? "Leave" : MARK_META[m!].label}
                    </Badge>
                    {m === "A" && !lv && d >= addDays(today(), -14) && (
                      <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => setApply({ from: isoDate(d), to: isoDate(d) })}>
                        Send reason
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t border-line px-5 py-6 text-center text-[13px] text-muted">{child.firstName} hasn&rsquo;t missed a day this term.</p>
          )}
          {recentAway.length > 10 && <p className="px-5 py-3 text-[12px] text-muted">Showing the latest 10 of {recentAway.length}.</p>}
        </Card>

        <Card>
          <CardHeader title="Leave applications" description={`Sent to ${teacherName}`} />
          {myLeave.length ? (
            <ul className="border-t border-line">
              {[...myLeave].reverse().map((l) => {
                const days = schoolDaysBetween(fromIso(l.from), fromIso(l.to)).length;
                return (
                  <li key={l.id} className="border-b border-line px-5 py-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-medium text-ink">
                        {l.from === l.to ? fmtWeekday(fromIso(l.from)) : `${fmtDay(fromIso(l.from))} – ${fmtDay(fromIso(l.to))}`}
                      </p>
                      <Badge tone="info">Sent</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-muted">
                      {l.reason} · {plural(days, "school day")} · applied {relativeDays(new Date(l.appliedAt), new Date()).toLowerCase()}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="border-t border-line px-5 py-6 text-center">
              <p className="text-[13px] text-muted">No leave applied this term.</p>
              <Button className="mt-3" size="sm" variant="secondary" onClick={() => setApply({ from: isoDate(nextSchoolDay(today())), to: isoDate(nextSchoolDay(today())) })}>
                <CalendarPlus /> Apply for leave
              </Button>
            </div>
          )}
        </Card>
      </div>

      <ApplyLeave
        key={apply ? `${apply.from}-${apply.to}` : "closed"}
        open={apply !== null}
        initial={apply}
        childName={child.firstName}
        teacherName={teacherName}
        onClose={() => setApply(null)}
        onSubmit={(l) => {
          const entry: StudentLeave = { ...l, id: `SL-${Date.now()}`, studentId: child.id, appliedAt: new Date().toISOString() };
          setState((st) => ({ studentLeave: [...st.studentLeave, entry] }));
          setApply(null);
          toast({ title: `Leave applied for ${child.firstName}`, body: `${teacherName} will see it on the register. You'll be notified when it's approved.` });
          const from = fromIso(l.from);
          setMonth(new Date(from.getFullYear(), from.getMonth(), 1));
        }}
      />
    </>
  );
}

function ApplyLeave({
  open,
  initial,
  childName,
  teacherName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: { from: string; to: string } | null;
  childName: string;
  teacherName: string;
  onClose: () => void;
  onSubmit: (l: { from: string; to: string; reason: string; details: string }) => void;
}) {
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [reason, setReason] = useState(LEAVE_REASONS[0]);
  const [details, setDetails] = useState("");
  const [tried, setTried] = useState(false);

  const min = isoDate(addDays(today(), -14));
  const max = isoDate(addDays(today(), 90));
  const f = from ? fromIso(from) : null;
  const t = to ? fromIso(to) : null;
  const order = f && t && t < f;
  const range = f && t && !order ? schoolDaysBetween(f, t) : [];
  const skipped = f && t && !order ? Array.from({ length: Math.round((t.getTime() - f.getTime()) / 86400000) + 1 }, (_, i) => addDays(f, i)).filter((d) => !isWeekend(d) && !isSchoolDay(d)) : [];

  const errFrom = !from ? "Choose the first day" : from < min ? "Leave can be applied up to 14 days after the absence" : from > max ? "That's too far ahead" : null;
  const errTo = !to ? "Choose the last day" : order ? "The last day can't be before the first" : null;
  const errRange = !errFrom && !errTo && range.length === 0 ? "These dates have no school days" : null;
  const errDetails = reason === "Other" && !details.trim() ? "Please add a line about the reason" : null;
  const valid = !errFrom && !errTo && !errRange && !errDetails;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Apply for leave · ${childName}`}
      description={`Goes to ${teacherName}, the class teacher.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setTried(true);
              if (valid) onSubmit({ from, to, reason, details: details.trim() });
            }}
          >
            <Send /> Send application
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="lv-from" error={tried ? errFrom : null}>
            <Input id="lv-from" type="date" value={from} min={min} max={max} onChange={(e) => (setFrom(e.target.value), (!to || e.target.value > to) && setTo(e.target.value))} />
          </Field>
          <Field label="To" htmlFor="lv-to" error={tried ? errTo : null}>
            <Input id="lv-to" type="date" value={to} min={from || min} max={max} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className={cn("rounded-lg px-3.5 py-2.5 text-[12.5px]", errRange && tried ? "bg-bad-soft text-bad" : "bg-surface-2 text-ink-2")}>
          {range.length ? (
            <>
              <span className="font-semibold">{plural(range.length, "school day")}</span>
              {range.length > 1 ? ` · ${fmtWeekday(range[0])} to ${fmtWeekday(range[range.length - 1])}` : ` · ${fmtWeekdayLong(range[0])}`}
              {skipped.length > 0 && <span className="text-muted"> · {skipped.map((d) => holidayName(d)).filter((v, i, a) => a.indexOf(v) === i).join(", ")} not counted</span>}
            </>
          ) : errRange ? (
            errRange
          ) : (
            <span className="text-muted">Pick the dates to see how many school days this covers.</span>
          )}
        </div>
        <Field label="Reason" htmlFor="lv-reason">
          <Select id="lv-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full">
            {LEAVE_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field
          label="Note for the class teacher"
          htmlFor="lv-details"
          error={tried ? errDetails : null}
          hint={reason === "Unwell" && range.length > 2 ? "For illness over 3 days, please send a medical certificate when your child returns." : "Optional. Homework for missed days will be shared in the app."}
        >
          <Textarea id="lv-details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. Viral fever, doctor has advised rest till Friday." maxLength={240} />
        </Field>
      </div>
    </Dialog>
  );
}
