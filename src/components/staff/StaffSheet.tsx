"use client";

import { Mail, MessageSquareText, Phone } from "lucide-react";
import { useMemo } from "react";
import { KeyValue } from "@/components/ui/layout";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, cn, Meter } from "@/components/ui/primitives";
import { currentSchoolDay, leaveRequests } from "@/lib/data/attendance";
import { staff, type Staff } from "@/lib/data/people";
import { SUBJECTS, TEACHING_PERIODS, WEEKDAYS } from "@/lib/data/school";
import { fmtClock, fmtDay, plural } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { classesTaught, leaveBalance, shortClass, weekOf, type Presence } from "./staffData";

export function PresenceBadge({ p }: { p: Presence | undefined }) {
  if (!p) return null;
  if (p.status === "leave") return <Badge tone="info">On leave · {p.leave?.type}</Badge>;
  if (p.status === "late")
    return (
      <Badge tone="warn" className="tnum">
        Late · {p.time}
      </Badge>
    );
  return (
    <span className="tnum inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-ink-2">
      <span className="size-1.5 rounded-full bg-good" aria-hidden />
      In · {p.time}
    </span>
  );
}

export function StaffSheet({ person, presence, onClose }: { person: Staff | null; presence: Presence | undefined; onClose: () => void }) {
  const toast = useToast();
  const leaveStore = useAppState((s) => s.leaveDecisions);
  const day = currentSchoolDay();
  const todayIdx = (day.getDay() + 6) % 7;

  const data = useMemo(() => {
    if (!person) return null;
    const week = weekOf(person.id);
    const load = week.reduce((a, d) => a + d.filter(Boolean).length, 0);
    const perDay = week.map((d) => d.filter(Boolean).length);
    const busiest = perDay.indexOf(Math.max(...perDay));
    return {
      week,
      load,
      busiest,
      perDay,
      classes: classesTaught(person.id),
      balance: leaveBalance(person),
      history: leaveRequests().filter((l) => l.staff.id === person.id),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, leaveStore]);

  const yearsHere = person ? new Date().getFullYear() - person.joinedYear : 0;

  return (
    <Dialog
      open={!!person}
      onClose={onClose}
      side
      title={person ? `${person.title} ${person.name}` : ""}
      description={person ? `${person.designation} · ${person.department}` : ""}
      footer={
        person && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast({ title: `Message sent to ${person.title} ${person.lastName}`, body: "Delivered to the staff app and by email." });
              }}
            >
              <MessageSquareText /> Message
            </Button>
          </>
        )
      }
    >
      {person && data && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={person.name} size={52} />
            <div className="min-w-0 flex-1">
              <PresenceBadge p={presence} />
              <div className="mt-1.5 flex flex-col gap-0.5 text-[12.5px]">
                <a href={`tel:${person.phone.replace(/\s/g, "")}`} className="tnum inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
                  <Phone className="size-3.5 text-muted" aria-hidden /> {person.phone}
                </a>
                <a href={`mailto:${person.email}`} className="inline-flex min-w-0 items-center gap-1.5 text-ink-2 hover:text-ink">
                  <Mail className="size-3.5 shrink-0 text-muted" aria-hidden /> <span className="truncate">{person.email}</span>
                </a>
              </div>
            </div>
          </div>

          {presence?.status === "leave" && presence.leave && (
            <div className="rounded-lg bg-info-soft px-3.5 py-2.5 text-[12.5px] text-info">
              On {presence.leave.type.toLowerCase()} leave {presence.leave.days > 1 ? `until ${fmtDay(presence.leave.to)}` : "today"} — “{presence.leave.reason}”.
              {presence.leave.substitute && <span className="block text-ink-2">Cover: {presence.leave.substitute}</span>}
            </div>
          )}

          <dl className="divide-y divide-line border-y border-line">
            <KeyValue k="Employee ID" v={<span className="tnum">AIS/EMP/{String(staff().findIndex((x) => x.id === person.id) + 1041).padStart(4, "0")}</span>} />
            <KeyValue k="Qualification" v={person.qualification} />
            <KeyValue k="At the school since" v={`${person.joinedYear} · ${plural(yearsHere, "year")}`} />
            <KeyValue k="Total experience" v={plural(person.experience, "year")} />
            {person.subjects.length > 0 && <KeyValue k="Subjects" v={person.subjects.map((s) => SUBJECTS[s]?.name ?? s).join(", ")} />}
            {person.classTeacherOf && <KeyValue k="Class teacher of" v={<Badge tone="brand">{shortClass(person.classTeacherOf)}</Badge>} />}
            {data.classes.length > 0 && <KeyValue k="Teaches" v={data.classes.map(shortClass).join(", ")} />}
          </dl>

          {data.load > 0 && (
            <section>
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] font-semibold text-ink">Weekly timetable</h3>
                <span className="tnum text-[12px] text-muted">
                  {data.load} of 40 periods · {40 - data.load} free
                </span>
              </div>
              <div className="grid grid-cols-[34px_repeat(8,minmax(0,1fr))] gap-[3px] text-center">
                <div />
                {TEACHING_PERIODS.map((p) => (
                  <div key={p.n} className="pb-0.5 text-[10.5px] font-medium text-faint" title={`${fmtClock(p.start)}–${fmtClock(p.end)}`}>
                    P{p.n}
                  </div>
                ))}
                {WEEKDAYS.map((d, di) => (
                  <Row key={d} label={d} slots={data.week[di]} today={di === todayIdx} />
                ))}
              </div>
              <p className="mt-2 text-[12px] text-muted">
                Busiest on {WEEKDAYS[data.busiest]} with {data.perDay[data.busiest]} periods{data.perDay[todayIdx] !== undefined ? ` · ${data.perDay[todayIdx]} today` : ""}.
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-3 text-[13px] font-semibold text-ink">Leave balance · this year</h3>
            <ul className="flex flex-col gap-3">
              {data.balance.map((b) => (
                <li key={b.type} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 text-[12.5px]">
                  <span className="text-ink-2">{b.type}</span>
                  <Meter value={b.used / b.total} tone={b.used / b.total > 0.75 ? "warn" : "brand"} label={`${b.type} leave used`} />
                  <span className="tnum w-24 text-right text-muted">
                    <span className="font-semibold text-ink">{b.total - b.used}</span> of {b.total} left
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {data.history.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold text-ink">Recent requests</h3>
              <ul className="divide-y divide-line border-y border-line">
                {data.history.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
                    <span className="min-w-0">
                      <span className="block text-ink">
                        {l.type} · {fmtDay(l.from)}
                        {l.days > 1 ? `–${fmtDay(l.to)}` : ""}
                      </span>
                      <span className="block truncate text-muted">{l.reason}</span>
                    </span>
                    <Badge tone={l.status === "approved" ? "good" : l.status === "declined" ? "neutral" : "warn"}>{l.status === "pending" ? "Pending" : l.status === "approved" ? "Approved" : "Declined"}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Row({ label, slots, today }: { label: string; slots: ({ classKey: string; subject: string; room: string } | null)[]; today: boolean }) {
  return (
    <>
      <div className={cn("flex items-center text-[11px] font-medium", today ? "text-brand" : "text-muted")}>{label}</div>
      {slots.map((s, i) =>
        s ? (
          <div
            key={i}
            title={`${SUBJECTS[s.subject]?.name ?? s.subject} · ${shortClass(s.classKey)} · ${s.room}`}
            className={cn("tnum flex h-7 items-center justify-center rounded-[5px] text-[10.5px] font-semibold", today ? "bg-brand text-white" : "bg-brand-soft text-brand")}
          >
            {shortClass(s.classKey)}
          </div>
        ) : (
          <div key={i} className="h-7 rounded-[5px] border border-dashed border-line" aria-label="Free" />
        ),
      )}
    </>
  );
}
