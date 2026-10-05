"use client";

import { cn } from "@/components/ui/primitives";
import { markFor, type Mark } from "@/lib/data/attendance";
import { holidayName, isoDate, isWeekend } from "@/lib/data/calendar";
import type { Student } from "@/lib/data/people";
import { fmtDay, fmtMonthYear } from "@/lib/format";

export const MARK_STYLE: Record<Mark, { label: string; cell: string; dot: string }> = {
  P: { label: "Present", cell: "bg-good-soft text-good", dot: "bg-good" },
  L: { label: "Late", cell: "bg-warn-soft text-warn", dot: "bg-[#D9961F]" },
  A: { label: "Absent", cell: "bg-bad text-white", dot: "bg-bad" },
  E: { label: "On leave", cell: "bg-info-soft text-info", dot: "bg-info" },
};

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

/** One month of a student's register: a coloured tile per school day. */
export function MonthCalendar({
  student,
  month,
  today,
  size = "md",
  title,
  className,
}: {
  student: Student;
  month: Date;
  today: Date;
  size?: "sm" | "md";
  title?: React.ReactNode;
  className?: string;
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const sm = size === "sm";

  return (
    <div className={className}>
      <div className={cn("mb-2 font-medium text-ink", sm ? "text-[12.5px]" : "text-[13px]")}>{title ?? fmtMonthYear(month)}</div>
      <div className={cn("grid grid-cols-7", sm ? "gap-[3px]" : "gap-1")}>
        {WEEK.map((w, i) => (
          <div key={i} className={cn("text-center font-medium text-faint", sm ? "text-[10px]" : "text-[11px]")} aria-hidden>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const future = d > today;
          const weekend = isWeekend(d);
          const holiday = !weekend ? holidayName(d) : null;
          const vacation = holiday === "Summer vacation" || holiday === "Winter break";
          const m = !future && !weekend && !holiday ? markFor(student, d) : null;
          const isToday = isoDate(d) === isoDate(today);
          const label = `${fmtDay(d)}: ${m ? MARK_STYLE[m].label : holiday ?? (weekend ? "Weekend" : future ? "Upcoming" : "Not marked")}`;
          return (
            <div
              key={i}
              title={label}
              aria-label={label}
              className={cn(
                "tnum flex items-center justify-center rounded-[5px] font-medium",
                sm ? "h-[22px] text-[10.5px]" : "h-8 text-[12px]",
                m ? MARK_STYLE[m].cell : vacation || weekend ? "text-faint" : holiday ? "border border-dashed border-line-strong text-muted" : future ? "bg-ink/[0.025] text-faint" : "bg-ink/[0.04] text-muted",
                isToday && "ring-[1.5px] ring-ink/70 ring-offset-1 ring-offset-surface",
              )}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-ink-2", className)}>
      {(Object.keys(MARK_STYLE) as Mark[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-[3px]", MARK_STYLE[k].cell.split(" ")[0])} aria-hidden />
          {MARK_STYLE[k].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[3px] border border-dashed border-line-strong" aria-hidden />
        Holiday
      </li>
    </ul>
  );
}
