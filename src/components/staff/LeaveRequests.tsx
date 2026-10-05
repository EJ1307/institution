"use client";

import { CalendarCheck2, Check, ChevronDown, Undo2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/forms";
import { EmptyState } from "@/components/ui/layout";
import { Menu, MenuItem, MenuLabel, useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { currentSchoolDay, leaveRequests, type LeaveRequest } from "@/lib/data/attendance";
import { isoDate, today } from "@/lib/data/calendar";
import { SUBJECTS, WEEKDAYS } from "@/lib/data/school";
import { fmtDay, fmtWeekday, plural, relativeDays } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";
import { coverPlan, shortClass, type CoverOption } from "./staffData";

type Filter = "pending" | "approved" | "declined" | "all";

const TYPE_TONE: Record<LeaveRequest["type"], "neutral" | "info" | "warn" | "brand"> = { Casual: "neutral", Sick: "warn", Earned: "info", "On duty": "brand" };

export function LeaveRequests({ onOpen }: { onOpen: (staffId: string) => void }) {
  const toast = useToast();
  const decisions = useAppState((s) => s.leaveDecisions);
  const subs = useAppState((s) => s.leaveSubstitutes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => leaveRequests(), [decisions, subs]);
  const counts = {
    pending: list.filter((l) => l.status === "pending").length,
    approved: list.filter((l) => l.status === "approved").length,
    declined: list.filter((l) => l.status === "declined").length,
  };
  const [filter, setFilter] = useState<Filter>(counts.pending ? "pending" : "all");
  const [choice, setChoice] = useState<Record<string, string>>({});

  const rows = list
    .filter((l) => filter === "all" || l.status === filter)
    .sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || a.from.getTime() - b.from.getTime());

  const decide = (l: LeaveRequest, status: "approved" | "declined", cover?: CoverOption) => {
    setState((st) => {
      const leaveSubstitutes = { ...st.leaveSubstitutes };
      if (status === "approved" && cover) leaveSubstitutes[l.id] = `${cover.staff.title} ${cover.staff.name}`;
      else delete leaveSubstitutes[l.id];
      return { leaveDecisions: { ...st.leaveDecisions, [l.id]: status }, leaveSubstitutes };
    });
    const who = `${l.staff.title} ${l.staff.name}`;
    if (status === "approved")
      toast({
        title: `Leave approved for ${who}`,
        body: cover ? `${cover.staff.title} ${cover.staff.name} will cover ${plural(coverPlan(l)?.slots.length ?? 0, "period")}. Both have been notified.` : `${l.staff.firstName} has been notified in the staff app.`,
      });
    else toast({ title: `Leave declined for ${who}`, body: `${l.staff.firstName} has been notified and can reapply with different dates.`, tone: "info" });
  };

  const undo = (l: LeaveRequest) => {
    setState((st) => {
      const leaveDecisions = { ...st.leaveDecisions };
      const leaveSubstitutes = { ...st.leaveSubstitutes };
      delete leaveDecisions[l.id];
      delete leaveSubstitutes[l.id];
      return { leaveDecisions, leaveSubstitutes };
    });
    toast({ title: "Decision undone", body: `${l.staff.title} ${l.staff.name}'s request is back to its original state.`, tone: "info" });
  };

  const changeCover = (l: LeaveRequest, o: CoverOption) => {
    setState((st) => ({ leaveSubstitutes: { ...st.leaveSubstitutes, [l.id]: `${o.staff.title} ${o.staff.name}` } }));
    toast({ title: "Cover updated", body: `${o.staff.title} ${o.staff.name} will take ${l.staff.title} ${l.staff.lastName}'s classes.` });
  };

  return (
    <Card>
      <CardHeader
        title="Leave requests"
        description={`${plural(counts.pending, "request")} waiting for you · decisions reach the staff app instantly`}
        action={
          <div className="hidden md:block">
            <Segmented
              size="sm"
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "pending", label: "Pending", count: counts.pending },
                { value: "approved", label: "Approved", count: counts.approved },
                { value: "declined", label: "Declined", count: counts.declined },
                { value: "all", label: "All", count: list.length },
              ]}
            />
          </div>
        }
      />
      <div className="px-4 pb-3 md:hidden">
        <Segmented
          size="sm"
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "all", label: "All", count: list.length },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck2 />}
          title={filter === "pending" ? "You're all caught up" : "Nothing here"}
          body={filter === "pending" ? "No leave requests are waiting for a decision. New requests from the staff app appear here and on your dashboard." : "No requests match this filter."}
          className="border-t border-line"
        />
      ) : (
        <ul className="border-t border-line">
          {rows.map((l) => (
            <LeaveRow
              key={l.id}
              l={l}
              chosen={choice[l.id]}
              onChoose={(id) => setChoice((c) => ({ ...c, [l.id]: id }))}
              onDecide={decide}
              onUndo={decided(l, decisions) ? () => undo(l) : undefined}
              onChangeCover={(o) => changeCover(l, o)}
              onOpen={() => onOpen(l.staff.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function decided(l: LeaveRequest, decisions: Record<string, string>) {
  return Boolean(decisions[l.id]);
}

function LeaveRow({
  l,
  chosen,
  onChoose,
  onDecide,
  onUndo,
  onChangeCover,
  onOpen,
}: {
  l: LeaveRequest;
  chosen: string | undefined;
  onChoose: (id: string) => void;
  onDecide: (l: LeaveRequest, s: "approved" | "declined", cover?: CoverOption) => void;
  onUndo?: () => void;
  onChangeCover: (o: CoverOption) => void;
  onOpen: () => void;
}) {
  const plan = useMemo(() => coverPlan(l), [l]);
  const day = currentSchoolDay();
  const pick = plan?.options.find((o) => o.staff.id === chosen) ?? plan?.options[0];
  const ongoing = isoDate(l.from) <= isoDate(day) && isoDate(l.to) >= isoDate(day);
  const range = l.days > 1 ? `${fmtWeekday(l.from)} – ${fmtWeekday(l.to)}` : fmtWeekday(l.from);

  return (
    <li className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left lg:w-[260px] lg:shrink-0">
          <Avatar name={l.staff.name} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-medium text-ink hover:underline">
              {l.staff.title} {l.staff.name}
            </span>
            <span className="block truncate text-[12px] text-muted">{l.staff.designation}</span>
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TYPE_TONE[l.type]}>{l.type}</Badge>
            <span className="tnum text-[13px] font-medium text-ink">{range}</span>
            <span className="text-[12.5px] text-muted">
              · {plural(l.days, "day")}
              {ongoing ? " · on leave now" : ` · ${startsIn(l.from, day)}`}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-ink-2">“{l.reason}”</p>
          <p className="mt-0.5 text-[12px] text-muted">Applied {l.appliedOn >= today() ? "today" : relativeDays(l.appliedOn, today()) === "Yesterday" ? "yesterday" : `on ${fmtDay(l.appliedOn)}`} in the staff app</p>

          {plan && (
            <div className="mt-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
              {plan.slots.length === 0 ? (
                <p className="text-[12.5px] text-muted">
                  {l.staff.classTeacherOf ? `Class teacher of ${shortClass(l.staff.classTeacherOf)} — the class needs a teacher for the day.` : "No timetabled periods on these dates — no cover needed."}
                </p>
              ) : (
                <>
                  <p className="text-[12px] font-medium text-ink-2">
                    Cover needed for {plural(plan.slots.length, "period")}
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1">
                    {plan.slots.slice(0, 10).map((x, i) => (
                      <li key={i} className="tnum rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11.5px] text-ink-2" title={`${fmtDay(x.date)} · ${SUBJECTS[x.slot.subject]?.name ?? x.slot.subject} · ${x.slot.room}`}>
                        {l.days > 1 ? `${WEEKDAYS[x.day]} ` : ""}P{x.period + 1} · {shortClass(x.slot.classKey)}
                      </li>
                    ))}
                    {plan.slots.length > 10 && <li className="px-1 text-[11.5px] text-muted">+{plan.slots.length - 10} more</li>}
                  </ul>
                </>
              )}
              {l.status === "pending" && pick && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line pt-2.5 text-[12.5px]">
                  <span className="text-muted">Suggested cover</span>
                  <CoverMenu options={plan.options} current={pick} onPick={(o) => onChoose(o.staff.id)} total={plan.slots.length} />
                </div>
              )}
              {l.status === "approved" && l.substitute && (
                <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line pt-2.5 text-[12.5px]">
                  <span className="text-muted">Cover</span>
                  <CoverMenu
                    options={plan.options}
                    current={plan.options.find((o) => `${o.staff.title} ${o.staff.name}` === l.substitute) ?? null}
                    currentLabel={l.substitute}
                    onPick={onChangeCover}
                    total={plan.slots.length}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:w-[220px] lg:justify-end">
          {l.status === "pending" ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => onDecide(l, "declined")}>
                <X /> Decline
              </Button>
              <Button size="sm" variant="primary" onClick={() => onDecide(l, "approved", pick ?? undefined)}>
                <Check /> Approve
              </Button>
            </>
          ) : (
            <>
              <Badge tone={l.status === "approved" ? "good" : "neutral"} dot>
                {l.status === "approved" ? "Approved" : "Declined"}
              </Badge>
              {onUndo && (
                <Button size="sm" variant="ghost" onClick={onUndo}>
                  <Undo2 /> Undo
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function CoverMenu({
  options,
  current,
  currentLabel,
  onPick,
  total,
}: {
  options: CoverOption[];
  current: CoverOption | null;
  currentLabel?: string;
  onPick: (o: CoverOption) => void;
  total: number;
}) {
  return (
    <Menu
      width={300}
      align="start"
      label="Choose a substitute"
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="-mx-1.5 inline-flex flex-wrap items-center gap-x-1.5 rounded-md px-1.5 py-0.5 text-left font-medium text-ink hover:bg-ink/5"
        >
          <span className="whitespace-nowrap">{current ? `${current.staff.title} ${current.staff.name}` : currentLabel}</span>
          {current && (
            <span className={cn("tnum font-normal whitespace-nowrap", current.free === total ? "text-good" : "text-warn")}>
              free for {current.free === total ? "all" : `${current.free} of`} {plural(total, "period")}
            </span>
          )}
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Free during these periods</MenuLabel>
          {options.map((o) => (
            <MenuItem
              key={o.staff.id}
              icon={current?.staff.id === o.staff.id ? <Check className="text-brand" /> : <span className="block size-4" />}
              hint={`${o.free}/${total}`}
              onClick={() => {
                onPick(o);
                close();
              }}
            >
              <span className="block truncate">
                {o.staff.title} {o.staff.name}
              </span>
              <span className="block truncate text-[11.5px] text-muted">{o.reason}</span>
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
}

function startsIn(from: Date, day: Date) {
  const n = Math.round((from.getTime() - day.getTime()) / 86400000);
  if (n === 1) return "tomorrow";
  if (n > 1) return `in ${n} days`;
  if (n === -1) return "yesterday";
  return `${-n} days ago`;
}
