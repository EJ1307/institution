"use client";

import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock3, Download, Link2, MapPin, Plus, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Segmented } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Button, Card, cn } from "@/components/ui/primitives";
import { academicYear, addDays, isoDate, schoolDaysBetween, today } from "@/lib/data/calendar";
import { classLabel } from "@/lib/data/school";
import { fmtMonthYear, fmtWeekday, fmtWeekdayLong, plural } from "@/lib/format";
import { useBrand, useChild, useRole } from "@/lib/session";
import { getState, setState, useAppState } from "@/lib/store";
import { AddEventDialog } from "./AddEventDialog";
import { calendarItems, concerns, isStaffOnly, KIND_ORDER, KIND_STYLE, rangeLabel, spanDays, toIcs, untilLabel, type CalItem, type Kind } from "./model";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_LANES = 3;

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatch(m.matches);
    const on = () => setMatch(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return match;
}

export function CalendarView() {
  const role = useRole();
  const isAdmin = role === "admin";
  const { children } = useChild();
  const brand = useBrand();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const added = useAppState((s) => s.events);
  const acks = useAppState((s) => s.acks);

  const t = today();
  const [cursor, setCursor] = useState(() => startOfMonth(t));
  const [view, setView] = useState<"month" | "agenda">("month");
  const phone = useMedia("(max-width: 639px)");
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setView("agenda");
  }, []);
  const [hidden, setHidden] = useState<Kind[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Date>(t);
  const [flash, setFlash] = useState<string | null>(null);
  const addOpen = isAdmin && params.get("new") === "1";
  const [addDate, setAddDate] = useState<string | undefined>(undefined);
  const openAdd = (date?: string) => {
    setAddDate(date);
    router.replace(`${pathname}?new=1`, { scroll: false });
  };

  const gridStart = mondayOf(cursor);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const gridEnd = addDays(mondayOf(monthEnd), 6);
  const weeks = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000 + 1) / 7;

  const all = useMemo(() => {
    const list = calendarItems(addDays(gridStart, -1), addDays(gridEnd, 1));
    if (role === "parent") return list.filter((i) => !isStaffOnly(i) && concerns(i, children).length > 0);
    return list;
  }, [gridStart.getTime(), gridEnd.getTime(), role, children, added]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = all.filter((i) => !hidden.includes(i.kind));
  const inMonth = items.filter((i) => i.end >= cursor && i.start <= monthEnd);

  const workingDays = schoolDaysBetween(cursor, monthEnd).length;
  const monthHolidays = inMonth.filter((i) => i.kind === "Holiday").length;
  const monthEvents = inMonth.filter((i) => i.kind !== "Holiday").length;

  const open = all.find((i) => i.id === openId) ?? null;
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const goToday = () => {
    setCursor(startOfMonth(t));
    setSelected(t);
  };
  const isCurrentMonth = cursor.getTime() === startOfMonth(t).getTime();
  const ay = academicYear(cursor);

  const who =
    role === "parent" && children.length > 1
      ? (i: CalItem) => {
          if (i.kind === "Holiday") return null;
          const ks = concerns(i, children);
          return ks.length === children.length ? "Both children" : ks.map((k) => k.firstName).join(", ");
        }
      : undefined;

  const toggleKind = (k: Kind) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(id);
  }, [flash]);

  const description =
    role === "parent"
      ? `Holidays, exams, trips and PTMs for ${children.map((c) => c.firstName).join(" and ")}.`
      : role === "teacher"
        ? "Term dates, exams, holidays and school events, including staff meetings."
        : `Term dates, examinations, holidays and school events for AY ${ay.label}.`;

  return (
    <>
      <PageHeader
        title="Calendar"
        description={description}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              label="Calendar view"
              options={[
                { value: "month", label: "Month" },
                { value: "agenda", label: "Agenda" },
              ]}
            />
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText("https://laburnumacademy.org/calendar.ics").catch(() => {});
                toast({ title: "Calendar link copied", body: "Add it to Google Calendar under Other calendars → From URL. It stays in sync.", tone: "info" });
              }}
            >
              <Link2 /> Subscribe
            </Button>
            {isAdmin && (
              <Button variant="primary" onClick={() => openAdd()}>
                <CalendarPlus /> Add event
              </Button>
            )}
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Button variant="ghost" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
            <div className="min-w-0">
              <h2 className="title-serif text-[19px] leading-tight font-semibold text-ink" aria-live="polite">
                {fmtMonthYear(cursor)}
              </h2>
              <p className="text-[12px] text-muted">
                {plural(workingDays, "school day")} · {plural(monthEvents, "event")}
                {monthHolidays ? ` · ${plural(monthHolidays, "holiday")}` : ""}
              </p>
            </div>
            {!isCurrentMonth && (
              <Button size="sm" variant="secondary" onClick={goToday} className="ml-2">
                Today
              </Button>
            )}
          </div>
          <ul className="scroll-thin -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Show or hide event types">
            {KIND_ORDER.map((k) => {
              const off = hidden.includes(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    aria-pressed={!off}
                    onClick={() => toggleKind(k)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors",
                      off ? "border-dashed border-line-strong text-faint" : "border-line text-ink-2 hover:border-line-strong",
                    )}
                    title={off ? `Show ${k}` : `Hide ${k}`}
                  >
                    <span className="size-2 rounded-full" style={{ background: off ? "var(--line-strong)" : KIND_STYLE[k].dot }} />
                    {k}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {view === "month" ? (
          phone ? (
            <CompactMonth
              cursor={cursor}
              gridStart={gridStart}
              weeks={weeks}
              items={items}
              selected={selected}
              onSelect={setSelected}
              onOpen={setOpenId}
              today={t}
              who={who}
            />
          ) : (
            <MonthGrid
              cursor={cursor}
              gridStart={gridStart}
              weeks={weeks}
              items={items}
              today={t}
              flash={flash}
              onOpen={setOpenId}
              onDay={setDay}
              onAdd={isAdmin ? (d) => openAdd(isoDate(d)) : undefined}
            />
          )
        ) : (
          <Agenda cursor={cursor} monthEnd={monthEnd} items={inMonth} today={t} onOpen={setOpenId} role={role} who={who} hiddenAny={hidden.length > 0} onShowAll={() => setHidden([])} onAdd={isAdmin ? () => openAdd() : undefined} />
        )}
      </Card>

      {/* Day sheet */}
      <Dialog open={Boolean(day)} onClose={() => setDay(null)} side title={day ? fmtWeekdayLong(day) : ""} description={day ? untilLabel(day, t) : undefined}>
        {day && (
          <div className="flex flex-col gap-2">
            {items.filter((i) => i.start <= day && i.end >= day).map((i) => (
              <AgendaRow key={i.id} i={i} who={who} onOpen={() => {
                setDay(null);
                setOpenId(i.id);
              }} />
            ))}
            {items.filter((i) => i.start <= day && i.end >= day).length === 0 && <p className="py-6 text-center text-[13px] text-muted">Nothing on this day.</p>}
            {isAdmin && (
              <Button variant="secondary" className="mt-2 self-start" onClick={() => {
                const d = day;
                setDay(null);
                openAdd(isoDate(d));
              }}>
                <Plus /> Add event on {fmtWeekday(day)}
              </Button>
            )}
          </div>
        )}
      </Dialog>

      {/* Event sheet */}
      <Dialog open={Boolean(open)} onClose={() => setOpenId(null)} side title={open ? (spanDays(open) > 1 ? `${rangeLabel(open)}` : fmtWeekdayLong(open.start)) : ""} description={open ? (open.end < t ? "Past event" : open.start <= t && spanDays(open) > 1 ? "On now" : untilLabel(open.start, t)) : undefined}>
        {open && (
          <EventDetail
            i={open}
            role={role}
            kids={role === "parent" ? concerns(open, children) : []}
            consentPending={open.id === "E2" && role === "parent" && !acks.N3}
            onIcs={() => {
              const blob = new Blob([toIcs(open, brand.school)], { type: "text/calendar" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${open.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              toast({ title: "Added to your calendar", body: "Open the downloaded file to save it in Google Calendar, Outlook or your phone." });
            }}
            onRemove={
              isAdmin && open.source === "added"
                ? () => {
                    setState({ events: getState().events.filter((e) => e.id !== open.id) });
                    setOpenId(null);
                    toast({ title: "Removed from the calendar", body: open.title, tone: "info" });
                  }
                : undefined
            }
          />
        )}
      </Dialog>

      <AddEventDialog
        open={addOpen}
        initialDate={addDate}
        onClose={() => router.replace(pathname, { scroll: false })}
        onAdded={(e) => {
          const d = new Date(e.date + "T00:00:00");
          setCursor(startOfMonth(d));
          setSelected(d);
          setFlash(e.id);
        }}
      />
    </>
  );
}

// ——— Month grid (tablet & desktop) ——————————————————————————————————

type Seg = { i: CalItem; s: number; e: number; lane: number; contL: boolean; contR: boolean };

function layoutWeek(items: CalItem[], weekStart: Date): { visible: Seg[]; more: number[] } {
  const weekEnd = addDays(weekStart, 6);
  const inWeek = items.filter((i) => i.end >= weekStart && i.start <= weekEnd);
  // longer spans first so they get the top lanes
  inWeek.sort((a, b) => a.start.getTime() - b.start.getTime() || spanDays(b) - spanDays(a));
  const lanes: number[][] = [];
  const segs: Seg[] = [];
  for (const i of inWeek) {
    const s = Math.max(0, Math.round((i.start.getTime() - weekStart.getTime()) / 86400000));
    const e = Math.min(6, Math.round((i.end.getTime() - weekStart.getTime()) / 86400000));
    let lane = 0;
    while (lanes[lane]?.some((c) => c >= s && c <= e)) lane++;
    (lanes[lane] ??= []).push(...Array.from({ length: e - s + 1 }, (_, k) => s + k));
    segs.push({ i, s, e, lane, contL: i.start < weekStart, contR: i.end > weekEnd });
  }
  const covering = (c: number) => segs.filter((g) => g.s <= c && g.e >= c);
  const overflow = Array.from({ length: 7 }, (_, c) => covering(c).length > MAX_LANES);
  // the last lane is kept for "+n more" wherever a day overflows
  const visible = segs.filter((g) => g.lane < MAX_LANES - 1 || (g.lane === MAX_LANES - 1 && !overflow.slice(g.s, g.e + 1).some(Boolean)));
  const more = Array.from({ length: 7 }, (_, c) => (overflow[c] ? covering(c).filter((g) => !visible.includes(g)).length : 0));
  return { visible, more };
}

function MonthGrid({
  cursor, gridStart, weeks, items, today: t, flash, onOpen, onDay, onAdd,
}: {
  cursor: Date; gridStart: Date; weeks: number; items: CalItem[]; today: Date; flash: string | null;
  onOpen: (id: string) => void; onDay: (d: Date) => void; onAdd?: (d: Date) => void;
}) {
  return (
    <div role="grid" aria-label={`${fmtMonthYear(cursor)} calendar`} className="border-t border-line">
      <div role="row" className="grid grid-cols-7 bg-surface-2">
        {WEEK.map((w, i) => (
          <div key={w} role="columnheader" className={cn("px-2.5 py-2 text-[11px] font-semibold tracking-[0.06em] uppercase", i >= 5 ? "text-faint" : "text-muted")}>
            {w}
          </div>
        ))}
      </div>
      {Array.from({ length: weeks }, (_, w) => {
        const ws = addDays(gridStart, w * 7);
        const { visible, more } = layoutWeek(items, ws);
        return (
          <div key={w} role="row" className="relative grid grid-cols-7 border-t border-line" style={{ minHeight: 30 + MAX_LANES * 25 + 14 }}>
            {Array.from({ length: 7 }, (_, d) => {
              const date = addDays(ws, d);
              const outside = date.getMonth() !== cursor.getMonth();
              const weekend = d >= 5;
              const isToday = sameDay(date, t);
              return (
                <div
                  key={d}
                  role="gridcell"
                  aria-label={fmtWeekdayLong(date)}
                  className={cn("group relative border-l border-line first:border-l-0", weekend && "bg-[color-mix(in_oklab,var(--paper)_70%,var(--surface))]", outside && "bg-surface-2")}
                >
                  <div className="flex items-center justify-between px-1.5 pt-1.5">
                    <button
                      type="button"
                      onClick={() => onDay(date)}
                      aria-label={`${fmtWeekdayLong(date)}${isToday ? ", today" : ""}`}
                      className={cn(
                        "tnum grid size-[26px] place-items-center rounded-full text-[12.5px] transition-colors",
                        isToday ? "bg-brand font-semibold text-white" : outside ? "text-faint hover:bg-ink/5" : weekend ? "text-muted hover:bg-ink/5" : "font-medium text-ink-2 hover:bg-ink/5",
                      )}
                    >
                      {date.getDate()}
                    </button>
                    {onAdd && (
                      <button
                        type="button"
                        onClick={() => onAdd(date)}
                        aria-label={`Add event on ${fmtWeekday(date)}`}
                        className="grid size-6 place-items-center rounded-md text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink/5 hover:text-ink focus-visible:opacity-100"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="pointer-events-none absolute inset-x-0 top-[34px] grid grid-cols-7 gap-y-[3px]" style={{ gridAutoRows: "22px" }}>
              {visible.map((g) => (
                <EventBar key={g.i.id + w} g={g} flash={flash === g.i.id} onOpen={() => onOpen(g.i.id)} />
              ))}
              {more.map((m, c) =>
                m > 0 ? (
                  <button
                    key={`more-${c}`}
                    type="button"
                    onClick={() => onDay(addDays(ws, c))}
                    className="pointer-events-auto mx-1.5 truncate rounded px-1 text-left text-[11.5px] font-medium text-muted hover:bg-ink/5 hover:text-ink"
                    style={{ gridColumn: c + 1, gridRow: MAX_LANES }}
                  >
                    +{m} more
                  </button>
                ) : null,
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventBar({ g, flash, onOpen }: { g: Seg; flash: boolean; onOpen: () => void }) {
  const st = KIND_STYLE[g.i.kind];
  const filled = !g.i.time || g.e > g.s || g.contL || g.contR;
  const style: CSSProperties = { gridColumn: `${g.s + 1} / ${g.e + 2}`, gridRow: g.lane + 1 };
  return (
    <button
      type="button"
      onClick={onOpen}
      style={filled ? { ...style, background: st.bg, color: st.fg } : style}
      title={`${g.i.title}${g.i.time ? ` · ${g.i.time}` : ""}`}
      className={cn(
        "pointer-events-auto flex min-w-0 items-center gap-1.5 overflow-hidden rounded-[5px] px-1.5 text-left text-[11.5px] leading-none whitespace-nowrap transition-[filter,box-shadow]",
        filled ? "font-medium hover:brightness-[0.97]" : "text-ink-2 hover:bg-ink/[0.05]",
        g.contL ? "rounded-l-none" : "ml-1.5",
        g.contR ? "rounded-r-none" : "mr-1.5",
        flash && "ring-2 ring-brand ring-offset-1",
      )}
    >
      {!filled && <span className="size-[7px] shrink-0 rounded-full" style={{ background: st.dot }} />}
      <span className="truncate">
        {g.i.title}
        {!filled && g.i.time && <span className="tnum ml-1.5 text-muted">{g.i.time}</span>}
      </span>
    </button>
  );
}

// ——— Compact month (phones) ———————————————————————————————————————

function CompactMonth({
  cursor, gridStart, weeks, items, selected, onSelect, onOpen, today: t, who,
}: {
  cursor: Date; gridStart: Date; weeks: number; items: CalItem[]; selected: Date; onSelect: (d: Date) => void; onOpen: (id: string) => void; today: Date; who?: (i: CalItem) => string | null;
}) {
  const dayItems = items.filter((i) => i.start <= selected && i.end >= selected);
  return (
    <div className="border-t border-line">
      <div className="grid grid-cols-7 bg-surface-2">
        {WEEK.map((w, i) => (
          <div key={w} className={cn("py-1.5 text-center text-[10.5px] font-semibold uppercase", i >= 5 ? "text-faint" : "text-muted")}>
            {w.slice(0, 2)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 px-1 py-1.5">
        {Array.from({ length: weeks * 7 }, (_, k) => {
          const date = addDays(gridStart, k);
          const outside = date.getMonth() !== cursor.getMonth();
          const on = items.filter((i) => i.start <= date && i.end >= date);
          const kinds = [...new Set(on.map((i) => i.kind))].slice(0, 3);
          const isSel = sameDay(date, selected);
          const isToday = sameDay(date, t);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={`${fmtWeekdayLong(date)}, ${plural(on.length, "event")}`}
              aria-pressed={isSel}
              className={cn("flex h-[50px] flex-col items-center gap-1 rounded-lg pt-1.5", isSel && !isToday && "bg-ink/[0.06]")}
            >
              <span
                className={cn(
                  "tnum grid size-7 place-items-center rounded-full text-[13px]",
                  isToday ? "bg-brand font-semibold text-white" : outside ? "text-faint" : k % 7 >= 5 ? "text-muted" : "font-medium text-ink",
                )}
              >
                {date.getDate()}
              </span>
              <span className="flex h-1.5 gap-0.5">
                {kinds.map((kd) => (
                  <span key={kd} className="size-1.5 rounded-full" style={{ background: KIND_STYLE[kd].dot }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-line px-4 py-3">
        <p className="mb-2 text-[12.5px] font-semibold text-ink">
          {fmtWeekdayLong(selected)} <span className="font-normal text-muted">· {untilLabel(selected, t)}</span>
        </p>
        {dayItems.length ? (
          <div className="flex flex-col gap-2">
            {dayItems.map((i) => (
              <AgendaRow key={i.id} i={i} who={who} onOpen={() => onOpen(i.id)} />
            ))}
          </div>
        ) : (
          <p className="py-3 text-[13px] text-muted">{selected.getDay() === 0 || selected.getDay() === 6 ? "Weekend. Nothing at school." : "A regular school day."}</p>
        )}
      </div>
    </div>
  );
}

// ——— Agenda ——————————————————————————————————————————————————————

function Agenda({
  cursor, monthEnd, items, today: t, onOpen, role, hiddenAny, onShowAll, onAdd, who,
}: {
  cursor: Date; monthEnd: Date; items: CalItem[]; today: Date; onOpen: (id: string) => void; role: string; hiddenAny: boolean; onShowAll: () => void; onAdd?: () => void; who?: (i: CalItem) => string | null;
}) {
  const groups = new Map<number, CalItem[]>();
  for (const i of items) {
    const d = i.start < cursor ? cursor : i.start;
    if (d > monthEnd) continue;
    groups.set(d.getTime(), [...(groups.get(d.getTime()) ?? []), i]);
  }
  const days = [...groups.keys()].sort((a, b) => a - b);
  if (!days.length) {
    return (
      <div className="border-t border-line">
        <EmptyState
          icon={<CalendarDays />}
          title={hiddenAny ? "Nothing to show with these filters" : `Nothing on the calendar in ${fmtMonthYear(cursor).split(" ")[0]}`}
          body={hiddenAny ? "Some event types are hidden." : role === "parent" ? "Nothing scheduled for your children's classes this month. Holidays and exams appear here as soon as they're announced." : "A quiet month: regular school days only."}
          action={hiddenAny ? <Button size="sm" onClick={onShowAll}>Show all types</Button> : onAdd ? <Button size="sm" onClick={onAdd}><Plus /> Add event</Button> : undefined}
        />
      </div>
    );
  }
  let todayMarked = false;
  return (
    <ol className="border-t border-line">
      {days.map((ms) => {
        const d = new Date(ms);
        const past = d < t && !groups.get(ms)!.some((i) => i.end >= t);
        const isToday = sameDay(d, t);
        const showMarker = !todayMarked && d >= t && !isToday && cursor <= t && monthEnd >= t;
        if (showMarker || isToday) todayMarked = true;
        return (
          <li key={ms}>
            {showMarker && (
              <div className="flex items-center gap-2 px-4 py-1.5 sm:px-5" aria-label="Today">
                <span className="text-[11px] font-semibold tracking-[0.06em] text-brand uppercase">Today</span>
                <span className="h-px flex-1 bg-brand/40" />
              </div>
            )}
            <div className={cn("flex gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:gap-5 sm:px-5", past && "opacity-60")}>
              <div className="w-11 shrink-0 pt-1 text-center sm:w-12">
                <p className={cn("text-[10.5px] font-semibold tracking-[0.06em] uppercase", isToday ? "text-brand" : "text-muted")}>{WEEK[(d.getDay() + 6) % 7]}</p>
                <p className={cn("tnum mx-auto mt-0.5 grid size-8 place-items-center rounded-full text-[17px] leading-none font-semibold", isToday ? "bg-brand text-white" : "text-ink")}>{d.getDate()}</p>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {groups.get(ms)!.map((i) => (
                  <AgendaRow key={i.id} i={i} who={who} onOpen={() => onOpen(i.id)} />
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function AgendaRow({ i, onOpen, who }: { i: CalItem; onOpen: () => void; who?: (i: CalItem) => string | null }) {
  const st = KIND_STYLE[i.kind];
  const multi = spanDays(i) > 1;
  const forWhom = who ? who(i) : i.kind === "Holiday" ? null : i.audience;
  const meta = [multi ? `${rangeLabel(i)} · ${spanDays(i)} days` : i.time, i.place, forWhom].filter(Boolean).join(" · ");
  return (
    <button type="button" onClick={onOpen} className="group flex w-full items-stretch gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2 sm:-mx-2">
      <span className="w-[3px] shrink-0 rounded-full" style={{ background: st.dot }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] leading-snug font-medium text-ink">{i.title}</span>
        {meta && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{meta}</span>}
      </span>
      <span className="hidden shrink-0 self-center rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline" style={{ background: st.bg, color: st.fg }}>
        {i.kind}
      </span>
    </button>
  );
}

// ——— Event detail ————————————————————————————————————————————————

function EventDetail({
  i, role, kids, consentPending, onIcs, onRemove,
}: {
  i: CalItem; role: string; kids: { firstName: string; grade: never | string; section: string }[]; consentPending: boolean; onIcs: () => void; onRemove?: () => void;
}) {
  const st = KIND_STYLE[i.kind];
  const t = today();
  const multi = spanDays(i) > 1;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium" style={{ background: st.bg, color: st.fg }}>
          <span className="size-1.5 rounded-full" style={{ background: st.dot }} /> {i.kind}
        </span>
        <h3 className="mt-3 text-[19px] leading-snug font-semibold text-ink">{i.title}</h3>
        {i.source === "added" && <p className="mt-1 text-[12.5px] text-muted">Added by the principal&apos;s office</p>}
      </div>
      <dl className="flex flex-col gap-3 rounded-xl border border-line px-4 py-3.5 text-[13px]">
        <Row icon={<CalendarDays />} k="When">
          {multi ? `${fmtWeekdayLong(i.start)} – ${fmtWeekdayLong(i.end)} · ${spanDays(i)} days` : fmtWeekdayLong(i.start)}
        </Row>
        {i.time && (
          <Row icon={<Clock3 />} k="Time">
            {i.time}
          </Row>
        )}
        {i.place && (
          <Row icon={<MapPin />} k="Where">
            {i.place}
          </Row>
        )}
        <Row icon={<UsersRound />} k="For">
          {i.kind === "Holiday" ? "Whole school · school and buses closed" : i.audience}
          {role === "parent" && kids.length > 0 && i.kind !== "Holiday" && (
            <span className="block text-[12px] text-muted">Concerns {kids.map((k) => `${k.firstName} (${classLabel(k.grade as never, k.section)})`).join(" and ")}</span>
          )}
        </Row>
      </dl>
      {i.note && <p className="text-[13.5px] leading-[1.65] text-ink-2">{i.note}</p>}
      {consentPending && (
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--warn)_30%,var(--line))] bg-warn-soft px-4 py-3">
          <p className="text-[13px] font-medium text-warn">Your consent is still needed for this trip</p>
          <Link href="/notices" className="mt-1 inline-block text-[12.5px] font-medium text-brand hover:underline">
            Open the consent notice
          </Link>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {i.end >= t && (
          <Button variant="secondary" onClick={onIcs}>
            <Download /> Add to my calendar
          </Button>
        )}
        {onRemove && (
          <Button variant="ghost" className="text-bad hover:text-bad" onClick={onRemove}>
            <Trash2 /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ icon, k, children }: { icon: ReactNode; k: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <dt className="sr-only">{k}</dt>
      <dd className="min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  );
}
