"use client";

import { ArrowRight, BookOpenCheck, CalendarClock, CheckCircle2, ClipboardCheck, Clock3, Coffee, MapPin, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarList, SERIES } from "@/components/charts/misc";
import { PageHeader, Stat } from "@/components/ui/layout";
import { Avatar, Badge, ButtonLink, Card, CardBody, CardHeader, cn } from "@/components/ui/primitives";
import { classDay, currentSchoolDay, isMarked, studentSummary } from "@/lib/data/attendance";
import { academicYear, isSchoolDay, schoolDaysBetween, today } from "@/lib/data/calendar";
import { homeworkFor, notices, upcomingEvents } from "@/lib/data/communication";
import { classResults, latestExam, upcomingExam } from "@/lib/data/exams";
import { studentsInClass } from "@/lib/data/people";
import { GRADE_BY_ID, PERIODS, TEACHING_PERIODS, classLabel, type GradeId } from "@/lib/data/school";
import { currentPeriodIndex, subjectName, teacherTimetable } from "@/lib/data/timetable";
import { fmtClock, fmtDay, fmtWeekdayLong, greeting, percent, relativeDays } from "@/lib/format";
import { useTeacher } from "@/lib/session";
import { useAppState } from "@/lib/store";

const MY_CLASS = "8-B";

export function TeacherDashboard() {
  const teacher = useTeacher();
  const attendanceStore = useAppState((s) => s.attendance);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const day = currentSchoolDay();
  const isToday = isSchoolDay(today()) && day.getTime() === today().getTime();
  const weekday = Math.min(4, Math.max(0, day.getDay() - 1));
  const week = useMemo(() => teacherTimetable(teacher.id), [teacher.id]);
  const todays = week[weekday];
  const current = isToday ? currentPeriodIndex(now) : null;

  const marked = isMarked(MY_CLASS, day);
  const myDay = useMemo(() => classDay(MY_CLASS, day), [day, attendanceStore]);

  const myClasses = useMemo(() => {
    const keys = new Set<string>();
    week.flat().forEach((s) => s && keys.add(s.classKey));
    return [MY_CLASS, ...[...keys].filter((k) => k !== MY_CLASS).sort((a, b) => GRADE_BY_ID[a.split("-")[0] as GradeId].order - GRADE_BY_ID[b.split("-")[0] as GradeId].order || a.localeCompare(b))];
  }, [week]);

  const exam = latestExam();
  const nextExam = upcomingExam();
  const mathAverages = myClasses.map((k) => {
    const res = classResults(k, exam);
    const idx = res?.subjects.findIndex((s) => s.id === "mat") ?? -1;
    return { key: k, avg: res && idx >= 0 ? res.subjectStats[idx].avgPct : 0 };
  });

  const support = useMemo(() => {
    const ay = academicYear(day);
    const days = schoolDaysBetween(ay.start, day);
    const res = classResults(MY_CLASS, exam);
    const mathIdx = res?.subjects.findIndex((s) => s.id === "mat") ?? -1;
    return studentsInClass(MY_CLASS)
      .map((s) => {
        const att = studentSummary(s, days);
        const row = res?.table.find((t) => t.student.id === s.id);
        const math = row && mathIdx >= 0 ? (row.marks[mathIdx] / exam.max) * 100 : null;
        const reasons: string[] = [];
        if (att.rate < 0.85) reasons.push(`Attendance ${percent(att.rate, 0)}`);
        if (math !== null && math < 50) reasons.push(`Maths ${Math.round(math)}%`);
        return { s, reasons, score: (0.85 - att.rate) * 2 + (math !== null ? (50 - math) / 50 : 0) };
      })
      .filter((x) => x.reasons.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [day, exam]);

  const homework = useMemo(
    () =>
      myClasses
        .flatMap((k) => homeworkFor(k, k.split("-")[0], k.split("-")[1]))
        .filter((h) => h.subject === "Mathematics")
        .sort((a, b) => b.assignedOn.getTime() - a.assignedOn.getTime())
        .slice(0, 3),
    [myClasses],
  );
  const teaching = todays.filter(Boolean).length;
  const first = teacher.firstName;

  return (
    <>
      <PageHeader
        eyebrow={`${fmtWeekdayLong(day)} · Class teacher, ${classLabel("8", "B")}`}
        title={`${greeting(now)}, ${first}`}
        description={`${teaching} lessons today${todays.findIndex(Boolean) >= 0 ? `, first at ${fmtClock(TEACHING_PERIODS[todays.findIndex(Boolean)].start)}` : ""}. ${marked ? "VIII-B's register is in." : "VIII-B's register is waiting for you."}`}
        actions={
          <>
            <ButtonLink href="/homework?new=1" variant="secondary">
              <NotebookPen /> Set homework
            </ButtonLink>
            <ButtonLink href="/attendance" variant="primary">
              <ClipboardCheck /> {marked ? "View register" : "Mark attendance"}
            </ButtonLink>
          </>
        }
      />

      {/* Register call-to-action */}
      {!marked ? (
        <Card className="mb-4 overflow-hidden border-[color-mix(in_oklab,var(--accent)_45%,var(--line))]">
          <div className="flex flex-col gap-4 bg-[color-mix(in_oklab,var(--accent)_9%,var(--surface))] px-5 py-4 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-warn shadow-[var(--shadow-card)]">
              <ClipboardCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">Today&apos;s register for VIII-B isn&apos;t marked yet</p>
              <p className="mt-0.5 text-[13px] text-ink-2">
                {studentsInClass(MY_CLASS).length} students · registers close at 9:30 am. Parents of absent children get an SMS automatically once you submit.
              </p>
            </div>
            <ButtonLink href="/attendance" variant="primary" className="self-start sm:self-auto">
              Mark now <ArrowRight />
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-good-soft text-good">
              <CheckCircle2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">VIII-B register submitted</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {myDay.present + myDay.late} present · {myDay.absent} absent · {myDay.leave} on leave — {percent(myDay.rate)} attendance
              </p>
            </div>
            <ButtonLink href="/attendance" variant="secondary" size="sm">
              Edit register
            </ButtonLink>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Lessons today" value={teaching} sub={`${8 - teaching} free periods`} />
        <Stat label="VIII-B attendance" value={marked ? percent(myDay.rate, 0) : "—"} sub={marked ? `${myDay.absent + myDay.leave} away today` : "Not marked yet"} />
        <Stat label={`Maths average · ${exam.short}`} value={`${(mathAverages.reduce((a, x) => a + x.avg, 0) / (mathAverages.length || 1)).toFixed(1)}%`} sub={`across ${mathAverages.length} sections`} />
        <Stat label="Next exam" value={nextExam ? fmtDay(nextExam.start) : "—"} sub={nextExam ? (nextExam.start <= today() ? `${nextExam.name} · under way` : `${nextExam.name} · in ${Math.round((nextExam.start.getTime() - today().getTime()) / 86400000)} days`) : "No exam scheduled"} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Today's schedule */}
        <Card className="xl:col-span-2">
          <CardHeader
            title={isToday ? "Today" : `Schedule · ${fmtWeekdayLong(day)}`}
            description="Your lessons, breaks and free periods"
            action={<ButtonLink href="/timetable" variant="ghost" size="sm">Week <ArrowRight /></ButtonLink>}
          />
          <ol className="px-5 pb-5">
            {PERIODS.map((p, i) => {
              if (p.n === 0) {
                return (
                  <li key={`b-${i}`} className="flex items-center gap-4 py-1.5 pl-[76px] text-[12px] text-faint">
                    <Coffee className="size-3.5" /> {p.label} · {fmtClock(p.start)}
                  </li>
                );
              }
              const idx = p.n - 1;
              const slot = todays[idx];
              const live = current === idx;
              const past = isToday && current !== null ? idx < current : false;
              return (
                <li key={p.n} className="flex items-stretch gap-4">
                  <div className={cn("w-[60px] shrink-0 pt-3 text-right text-[12px] tabular-nums", live ? "font-semibold text-brand" : "text-muted")}>{fmtClock(p.start).replace(" ", " ")}</div>
                  <div className="relative flex w-3 justify-center">
                    <span className="absolute inset-y-0 w-px bg-line" />
                    <span className={cn("relative mt-4 size-2.5 rounded-full border-2", live ? "border-brand bg-brand animate-pulse-dot" : slot ? "border-brand bg-surface" : "border-line-strong bg-surface")} />
                  </div>
                  <div className={cn("my-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-2.5", live ? "bg-brand-soft ring-1 ring-[color-mix(in_oklab,var(--brand)_25%,transparent)]" : slot ? "bg-surface-2" : "", past && "opacity-60")}>
                    {slot ? (
                      <>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium text-ink">
                            {subjectName(slot.subject)} · <span className="font-semibold">{classLabel(slot.classKey.split("-")[0] as GradeId, slot.classKey.split("-")[1])}</span>
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                            <MapPin className="size-3" /> {slot.room === classLabel(slot.classKey.split("-")[0] as GradeId, slot.classKey.split("-")[1]) ? `Room ${slot.room}` : slot.room} · Period {p.n}
                          </p>
                        </div>
                        {live && <Badge tone="brand" dot>Now</Badge>}
                        {slot.classKey === MY_CLASS && !live && <Badge tone="neutral">Your class</Badge>}
                      </>
                    ) : (
                      <p className="text-[13px] text-faint">Free period</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Students to check in on" description={`VIII-B · attendance under 85% or maths under 50%`} />
            <ul className="px-5 pb-4">
              {support.map(({ s, reasons }) => (
                <li key={s.id}>
                  <Link href={`/students/${s.id}`} className="-mx-2 flex items-center gap-3 rounded-lg border-t border-line px-2 py-2.5 hover:bg-surface-2">
                    <Avatar name={s.name} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{s.name}</span>
                      <span className="block truncate text-[12px] text-muted">Roll {s.roll}</span>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      {reasons.map((r) => (
                        <Badge key={r} tone={r.startsWith("Att") ? "warn" : "bad"}>
                          {r}
                        </Badge>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
              {support.length === 0 && <li className="py-3 text-[13px] text-muted">Everyone in VIII-B is on track.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Homework you set" icon={<NotebookPen />} action={<ButtonLink href="/homework" variant="ghost" size="sm">All</ButtonLink>} />
            <ul className="px-5 pb-4">
              {homework.map((h, i) => {
                const total = studentsInClass(h.classKey).length;
                const done = Math.round(total * (0.62 + i * 0.13));
                return (
                  <li key={h.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
                    <p className="truncate text-[13px] font-medium">{h.title}</p>
                    <div className="mt-1 flex items-center justify-between text-[12px] text-muted">
                      <span>
                        {classLabel(h.classKey.split("-")[0] as GradeId, h.classKey.split("-")[1])} · due {relativeDays(h.dueOn, today()).toLowerCase()}
                      </span>
                      <span className="tnum">
                        {Math.min(total, done)}/{total} submitted
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Maths average by section" description={`${exam.name} · % of maximum marks`} icon={<BookOpenCheck />} />
          <CardBody>
            <BarList
              rows={mathAverages.map((m) => ({ id: m.key, label: classLabel(m.key.split("-")[0] as GradeId, m.key.split("-")[1]), value: m.avg, color: m.key === MY_CLASS ? SERIES.s1 : SERIES.s3 }))}
              max={100}
              format={(n) => `${n.toFixed(1)}%`}
              labelWidth={56}
            />
            <p className="mt-4 text-[12px] text-muted">Your class teacher section is shown in green.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Coming up" icon={<CalendarClock />} action={<ButtonLink href="/calendar" variant="ghost" size="sm">Calendar</ButtonLink>} />
          <ul className="px-5 pb-4">
            {upcomingEvents(4).map((e) => (
              <li key={e.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
                <Clock3 className="size-4 shrink-0 text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{e.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {relativeDays(e.date, today())}
                    {e.time ? ` · ${e.time}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Notices for staff" action={<ButtonLink href="/notices" variant="ghost" size="sm">All</ButtonLink>} />
          <ul className="px-5 pb-4">
            {notices()
              .filter((n) => /staff|Staff|All/.test(n.audience))
              .slice(0, 3)
              .map((n) => (
                <li key={n.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
                  <p className="text-[13px] leading-snug font-medium">{n.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {n.author} · {relativeDays(n.postedAt, today())}
                  </p>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
