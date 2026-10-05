"use client";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/layout";
import { Badge, Card, CardHeader, cn } from "@/components/ui/primitives";
import { currentSchoolDay } from "@/lib/data/attendance";
import { isoDate } from "@/lib/data/calendar";
import { staffById } from "@/lib/data/people";
import { TEACHING_PERIODS, WEEKDAYS } from "@/lib/data/school";
import { classTimetable, currentPeriodIndex, subjectName, teacherTimetable } from "@/lib/data/timetable";
import { fmtClock, fmtWeekdayLong, plural } from "@/lib/format";
import { useTeacher } from "@/lib/session";
import { useAppState } from "@/lib/store";
import { busyIndex, cellSubject, labelOf, teacherShort, tintFor, WeekGrid, type CellSpec } from "./shared";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function TeacherTimetable() {
  const teacher = useTeacher();
  const subs = useAppState((s) => s.substitutions);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const day = currentSchoolDay();
  const iso = isoDate(day);
  const isToday = iso === isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayIdx = day.getDay() - 1;
  const current = isToday ? currentPeriodIndex(now) : null;
  const mins = now.getHours() * 60 + now.getMinutes();

  const tt = useMemo(() => teacherTimetable(teacher.id), [teacher.id]);

  // cover duties assigned to this teacher today (from the principal's substitutions)
  const covers = useMemo(() => {
    const out = new Map<number, { classKey: string; subject: string; forName: string }>();
    for (const [k, v] of Object.entries(subs)) {
      if (v !== teacher.id) continue;
      const [d, absentId, p] = k.split("|");
      if (d !== iso) continue;
      const ck = busyIndex().get(absentId)?.[todayIdx]?.[Number(p)];
      const slot = ck ? classTimetable(ck)?.[todayIdx][Number(p)] : null;
      if (ck && slot) out.set(Number(p), { classKey: ck, subject: slot.subject, forName: teacherShort(staffById(absentId)) });
    }
    return out;
  }, [subs, teacher.id, iso, todayIdx]);

  const cells: CellSpec[][] = WEEKDAYS.map((_, d) =>
    TEACHING_PERIODS.map((__, p) => {
      const slot = tt[d][p];
      if (!slot) {
        const c = d === todayIdx ? covers.get(p) : undefined;
        if (c) return { variant: "cover", title: `Cover · ${labelOf(c.classKey)}`, sub: cellSubject(c.subject), meta: `for ${c.forName}` };
        return { variant: "free", title: "Free" };
      }
      const lbl = labelOf(slot.classKey);
      return { tint: tintFor(slot.subject), title: lbl, sub: cellSubject(slot.subject), meta: slot.room !== lbl ? slot.room : slot.classKey === teacher.classTeacherOf ? "Your class" : undefined };
    }),
  );

  const lessons = tt.flat().filter(Boolean);
  const byClass = [...new Set(lessons.map((s) => s!.classKey))]
    .map((k) => ({ k, n: lessons.filter((s) => s!.classKey === k).length }))
    .sort((a, b) => b.n - a.n);
  const freeCount = 40 - lessons.length;
  const todays = todayIdx >= 0 && todayIdx < 5 ? TEACHING_PERIODS.map((p, i) => ({ p, i, slot: tt[todayIdx][i], cover: covers.get(i) })) : [];
  const dayEnd = TEACHING_PERIODS[TEACHING_PERIODS.length - 1].end;
  const after = isToday && mins >= toMin(dayEnd);
  const before = isToday && mins < toMin(TEACHING_PERIODS[0].start);
  const todayLessons = todays.filter((x) => x.slot || x.cover).length;

  return (
    <>
      <PageHeader
        eyebrow={`${teacher.title} ${teacher.name} · ${teacher.designation}`}
        title="My timetable"
        description={`${plural(lessons.length, "lesson")} a week across ${byClass.map((c) => labelOf(c.k)).join(", ")} · ${plural(freeCount, "free period")}.`}
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <CardHeader title="This week" description="Today's column is highlighted; free periods are dashed." />
          <div className="px-3 pb-4 sm:px-4">
            <WeekGrid cells={cells} today={todayIdx >= 0 && todayIdx < 5 ? todayIdx : null} current={current} ariaLabel="My weekly timetable" />
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader
              title={isToday ? "Today" : fmtWeekdayLong(day)}
              description={
                after
                  ? `School day ended at ${fmtClock(dayEnd)} · ${plural(todayLessons, "lesson")} taught`
                  : before
                    ? `First bell at ${fmtClock(TEACHING_PERIODS[0].start)} · ${plural(todayLessons, "lesson")}`
                    : `${plural(todayLessons, "lesson")} · ${fmtWeekdayLong(day)}`
              }
            />
            <ol className="border-t border-line px-5 py-2">
              {todays.map(({ p, i, slot, cover }) => {
                const done = isToday && mins >= toMin(p.end);
                const live = current === i;
                const lbl = slot ? labelOf(slot.classKey) : cover ? labelOf(cover.classKey) : null;
                return (
                  <li key={p.n} className={cn("relative flex gap-3 py-2", done && !live && "opacity-55")}>
                    <div className="flex w-14 shrink-0 flex-col pt-0.5">
                      <span className={cn("tnum text-[12px] font-semibold", live ? "text-brand" : "text-ink-2")}>{fmtClock(p.start)}</span>
                      <span className="text-[11px] text-muted">P{p.n}</span>
                    </div>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", live ? "animate-pulse-dot bg-good" : slot ? "bg-brand" : cover ? "bg-warn" : "border border-line-strong")} />
                    <div className="min-w-0 flex-1">
                      {slot ? (
                        <>
                          <p className="truncate text-[13px] font-medium text-ink">
                            {lbl} · {subjectName(slot.subject)}
                          </p>
                          <p className="flex items-center gap-1 truncate text-[12px] text-muted">
                            <MapPin className="size-3" aria-hidden /> {slot.room === lbl ? `Room ${lbl}` : slot.room}
                          </p>
                        </>
                      ) : cover ? (
                        <>
                          <p className="truncate text-[13px] font-medium text-ink">
                            Cover · {lbl} {subjectName(cover.subject)}
                          </p>
                          <p className="truncate text-[12px] text-warn">Substituting for {cover.forName}</p>
                        </>
                      ) : (
                        <p className="text-[13px] text-muted">Free period</p>
                      )}
                    </div>
                    {live && <Badge tone="good">Now</Badge>}
                  </li>
                );
              })}
              {todays.length === 0 && <li className="py-3 text-[13px] text-muted">No school today.</li>}
            </ol>
          </Card>

          <Card>
            <CardHeader title="Periods by class" description="Per week" />
            <ul className="border-t border-line px-5 py-2">
              {byClass.map(({ k, n }) => (
                <li key={k} className="flex items-center gap-3 py-1.5 text-[13px]">
                  <span className="w-14 font-medium text-ink">{labelOf(k)}</span>
                  <span className="flex flex-1 gap-[3px]" aria-hidden>
                    {Array.from({ length: n }, (_, i) => (
                      <span key={i} className="h-2 w-2.5 rounded-[2px]" style={{ background: tintFor(teacher.subjects[0] ?? "mat").edge }} />
                    ))}
                  </span>
                  <span className="tnum text-muted">{n}</span>
                </li>
              ))}
              <li className="flex items-center gap-3 border-t border-line py-2 text-[13px]">
                <span className="w-14 text-muted">Free</span>
                <span className="flex-1" />
                <span className="tnum text-muted">{freeCount}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
