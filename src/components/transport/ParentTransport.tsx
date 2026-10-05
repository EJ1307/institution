"use client";

import { Bus, Cctv, Gauge, Phone, Satellite, UserRoundCheck } from "lucide-react";
import { useMemo } from "react";
import { Switch } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Avatar, Badge, Button, Card, CardHeader, cn } from "@/components/ui/primitives";
import { isoDate, isSchoolDay, nextSchoolDay, schoolDaysBack, today } from "@/lib/data/calendar";
import type { Student } from "@/lib/data/people";
import { TRANSPORT_QUARTERLY } from "@/lib/data/school";
import { ROUTE_BY_ID, routeForLocality, type Route } from "@/lib/data/transport";
import { fmtTime, fmtWeekday, rupees } from "@/lib/format";
import { useChild } from "@/lib/session";
import { setState, useAppState } from "@/lib/store";
import { atMinutes, busDetails, clock, etaAt, liveStatus, onRoad, runLog, runWindow, stopIndexFor, toMin, useTicker, type Live, type Run } from "./live";
import { RouteMap, RouteTrack } from "./RouteMap";

export function ParentTransport() {
  const { child } = useChild();
  const route = child.routeId ? ROUTE_BY_ID[child.routeId] : null;
  return (
    <>
      <PageHeader
        eyebrow={route ? `School bus · Route ${route.id}` : "School bus"}
        title={`${child.firstName}'s bus`}
        description={route ? `${route.name} · ${route.bus}` : `${child.firstName} doesn't use school transport this year.`}
      />
      {route ? <Tracker key={child.id} child={child} route={route} /> : <NoTransport child={child} />}
    </>
  );
}

function Tracker({ child, route: r }: { child: Student; route: Route }) {
  const toast = useToast();
  const now = useTicker(5000);
  const absences = useAppState((s) => s.busAbsence);
  const n = r.stops.length;
  const c = stopIndexFor(child, r);
  const stop = r.stops[c];
  const day = today();
  const minute = Math.floor(now.getTime() / 60000);
  const l = liveStatus(r, now);
  const amLog = useMemo(() => runLog(r, day, "am", now), [r, day.getTime(), minute]);
  const pmLog = useMemo(() => runLog(r, day, "pm", now), [r, day.getTime(), minute]);
  const details = useMemo(() => busDetails(r), [r]);
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  // which day an absence report applies to: today until the afternoon run is over
  const pmOver = !isSchoolDay(now) || l.phase === "done";
  const absDay = pmOver ? nextSchoolDay(day) : day;
  const absKey = `${child.id}|${isoDate(absDay)}`;
  const skipping = !!absences[absKey];
  const skippingToday = !pmOver && skipping;

  const status = describe({ child, r, l, c, amLog, pmLog, nowMin, skipping: skippingToday });
  const trackRun: Run = l.run ?? (l.phase === "done" || (l.phase === "parked" && !l.closed && amLog[n - 1]) ? "pm" : "am");
  const complete = l.phase === "done" || (l.phase === "parked" && !l.closed && !!amLog[n - 1] && trackRun === "am");
  const times = r.stops.map((s, i) => clock(toMin(trackRun === "am" ? s.am : s.pm) + (onRoad(l) ? l.delay : 0)));
  const actualLog = trackRun === "am" ? amLog : pmLog;
  const actual = actualLog.map((d) => (d ? fmtTime(d) : null));

  const toggleAbsence = (on: boolean) => {
    setState((s) => {
      const next = { ...s.busAbsence };
      if (on) next[absKey] = new Date().toISOString();
      else delete next[absKey];
      return { busAbsence: next };
    });
    const when = absDay.getTime() === day.getTime() ? "today" : fmtWeekday(absDay);
    toast(
      on
        ? { title: `${child.firstName} is off the bus ${when}`, body: `${r.driver.split(" ")[0]} and ${r.attendant} won't wait at ${stop.name.split(" · ")[0]}. Turn it off if plans change.` }
        : { title: `${child.firstName} is back on the bus ${when}`, body: `Pickup at ${clock(toMin(stop.am))} from ${stop.name}.`, tone: "info" },
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <p className="flex items-center gap-2 pt-0.5 text-[12px] font-medium text-muted">
                <span className={cn("size-2 rounded-full", onRoad(l) ? "animate-pulse-dot bg-good" : "bg-faint")} />
                {onRoad(l) ? `Live · ${l.run === "am" ? "morning pickup" : "afternoon drop"}` : l.closed ? "No service today" : `${fmtWeekday(now)} · ${fmtTime(now)}`}
              </p>
              {status.eta && (
                <div className="-mt-1 shrink-0 rounded-xl bg-brand-soft px-3 py-1.5 text-right sm:hidden">
                  <p className="text-[10.5px] font-medium text-brand">{status.etaLabel}</p>
                  <p className="tnum text-[16px] leading-tight font-semibold text-brand-deep">{status.eta}</p>
                </div>
              )}
            </div>
            <div className="flex items-end justify-between gap-6">
              <div className="min-w-0">
                <h2 className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.015em] text-ink sm:text-[26px]">{status.headline}</h2>
                <p className="mt-1.5 max-w-xl text-[13.5px] leading-snug text-ink-2">{status.sub}</p>
              </div>
              {status.eta && (
                <div className="hidden shrink-0 rounded-xl bg-brand-soft px-4 py-2.5 text-right sm:block">
                  <p className="text-[11px] font-medium text-brand">{status.etaLabel}</p>
                  <p className="tnum text-[22px] leading-tight font-semibold text-brand-deep">{status.eta}</p>
                </div>
              )}
            </div>
          </div>
          {onRoad(l) && (
            <div className="mt-3 flex flex-wrap gap-2 px-5 sm:px-6">
              {l.delay > 2 ? <Badge tone="warn" dot>{`Running ${l.delay} min late`}</Badge> : <Badge tone="good" dot>On time</Badge>}
              {skippingToday && <Badge tone="neutral">{child.firstName} is off the bus today</Badge>}
            </div>
          )}

          {/* phones: vertical tracker; wider screens: the schematic line */}
          <div className="px-5 pt-5 pb-4 sm:hidden">
            <RouteTrack route={r} run={trackRun} position={l.position} live={onRoad(l)} highlight={c} times={times} actual={actual} complete={complete} />
          </div>
          <div className="hidden px-6 pt-4 pb-2 sm:block">
            <div className="rounded-xl border border-line bg-surface-2 px-4 pt-1">
              <RouteMap route={r} position={l.position} run={l.run} live={onRoad(l)} highlight={c} complete={complete} height={164} ariaLabel={`Route ${r.id} with ${child.firstName}'s stop, ${stop.name}, highlighted`} />
            </div>
          </div>

          <dl className="mt-2 grid grid-cols-2 gap-px border-t border-line bg-line text-[12.5px] sm:grid-cols-4">
            <Fact k="Pickup" v={clock(toMin(stop.am))} note={amLog[c] ? `Today ${fmtTime(amLog[c]!)}` : undefined} />
            <Fact k="Drop" v={clock(toMin(stop.pm))} note={pmLog[c] ? `Today ${fmtTime(pmLog[c]!)}` : undefined} />
            <Fact k="Reaches school" v={clock(toMin(r.stops[n - 1].am))} note={amLog[n - 1] ? `Today ${fmtTime(amLog[n - 1]!)}` : undefined} />
            <Fact k="Ride" v={`${toMin(r.stops[n - 1].am) - toMin(stop.am)} min`} note={`${n - 1 - c} stops to school`} />
          </dl>
        </Card>

        <WeekLog child={child} route={r} stopIdx={c} now={now} absences={absences} />
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <div className="flex items-start gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">{absDay.getTime() === day.getTime() ? `${child.firstName} won't take the bus today` : `Not taking the bus on ${fmtWeekday(absDay)}`}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-muted">
                {skipping
                  ? `${r.attendant} has been told not to wait at ${stop.name.split(" · ")[0]}${absDay.getTime() === day.getTime() ? " today" : ""}.`
                  : `Tell the crew so the bus doesn't wait at your stop. Attendance in class isn't affected.`}
              </p>
            </div>
            <Switch checked={skipping} onChange={toggleAbsence} label={`${child.firstName} won't take the bus`} />
          </div>
        </Card>

        <Card className="px-5 py-4">
          <p className="text-[12px] text-muted">Your stop · {c + 1} of {n - 1} on Route {r.id}</p>
          <p className="mt-0.5 text-[14px] font-semibold text-ink">{stop.name}</p>
          <p className="mt-2 text-[12.5px] leading-snug text-muted">You'll get an alert when the bus is two stops away. Please be at the stop two minutes early — the bus waits up to a minute.</p>
        </Card>

        <Card>
          <CardHeader title="Crew" description={`${r.bus} · ${details.model}`} />
          <ul className="px-5 pb-4">
            <CrewRow name={r.driver} role="Driver" phone={r.driverPhone} />
            <CrewRow name={r.attendant} role="Attendant" phone={details.attendantPhone} />
          </ul>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line px-5 py-3.5 text-[12px] text-ink-2">
            {[
              { icon: <Satellite />, label: "Live GPS" },
              { icon: <Cctv />, label: "CCTV on board" },
              { icon: <UserRoundCheck />, label: "Woman attendant" },
              { icon: <Gauge />, label: "Capped at 40 km/h" },
            ].map((x) => (
              <li key={x.label} className="flex items-center gap-2 [&_svg]:size-3.5 [&_svg]:text-brand">
                {x.icon}
                {x.label}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function WeekLog({ child, route: r, stopIdx: c, now, absences }: { child: Student; route: Route; stopIdx: number; now: Date; absences: Record<string, string> }) {
  const n = r.stops.length;
  const minute = Math.floor(now.getTime() / 60000);
  const rows = useMemo(
    () =>
      schoolDaysBack(5, today())
        .reverse()
        .map((d) => {
          const am = runLog(r, d, "am", now);
          const pm = runLog(r, d, "pm", now);
          const off = !!absences[`${child.id}|${isoDate(d)}`];
          const late = (at: Date | null, hhmm: string) => (at ? Math.round((at.getTime() - atMinutes(d, toMin(hhmm)).getTime()) / 60000) : 0);
          return { d, am: am[c], school: am[n - 1], pm: pm[c], off, amLate: late(am[c], r.stops[c].am), pmLate: late(pm[c], r.stops[c].pm) };
        }),
    [r, c, minute, absences, child.id, n],
  );
  const cell = (at: Date | null, lateBy: number, off: boolean, planned: string) =>
    off ? <span className="text-faint">—</span> : at ? (
      <span className={cn(lateBy > 2 ? "text-warn" : "text-ink")}>
        {fmtTime(at)}
        {lateBy > 2 && <span className="ml-1 text-[11px]">+{lateBy}</span>}
      </span>
    ) : (
      <span className="text-faint" title="Scheduled">
        {clock(toMin(planned))}
      </span>
    );
  return (
    <Card>
      <CardHeader title="Last five school days" description={`When the bus reached ${r.stops[c].name.split(" · ").pop()} and the school, from its GPS log`} />
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[420px] text-[13px]">
          <thead className="bg-surface-2 text-[11.5px] font-semibold text-muted">
            <tr>
              <th className="h-9 border-y border-line pl-5 text-left font-semibold">Day</th>
              <th className="h-9 border-y border-line px-3 text-right font-semibold">Picked up</th>
              <th className="h-9 border-y border-line px-3 text-right font-semibold">At school</th>
              <th className="h-9 border-y border-line pr-5 text-right font-semibold">Dropped</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {rows.map((x) => (
              <tr key={x.d.getTime()} className="border-b border-line last:border-b-0">
                <td className="h-11 pl-5 text-ink-2">
                  {x.d.getTime() === today().getTime() ? "Today" : fmtWeekday(x.d)}
                  {x.off && <span className="ml-2 text-[11.5px] text-muted">didn't ride</span>}
                </td>
                <td className="px-3 text-right">{cell(x.am, x.amLate, x.off, r.stops[c].am)}</td>
                <td className="px-3 text-right">{cell(x.school, 0, x.off, r.stops[n - 1].am)}</td>
                <td className="pr-5 text-right">{cell(x.pm, x.pmLate, x.off, r.stops[c].pm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Fact({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="bg-surface px-5 py-3 sm:px-6">
      <dt className="text-muted">{k}</dt>
      <dd className="tnum mt-0.5 text-[14px] font-semibold text-ink">{v}</dd>
      {note && <dd className="tnum text-[11.5px] text-muted">{note}</dd>}
    </div>
  );
}

function CrewRow({ name, role, phone }: { name: string; role: string; phone: string }) {
  return (
    <li className="flex items-center gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <Avatar name={name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{name}</p>
        <p className="tnum truncate text-[12px] text-muted">
          {role} · {phone.replace("+91 ", "")}
        </p>
      </div>
      <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-soft px-3.5 text-[12.5px] font-medium text-brand hover:brightness-[0.97]">
        <Phone className="size-3.5" /> Call
      </a>
    </li>
  );
}

type Status = { headline: string; sub: string; eta?: string; etaLabel?: string };

function describe({
  child,
  r,
  l,
  c,
  amLog,
  pmLog,
  nowMin,
  skipping,
}: {
  child: Student;
  r: Route;
  l: Live;
  c: number;
  amLog: (Date | null)[];
  pmLog: (Date | null)[];
  nowMin: number;
  skipping: boolean;
}): Status {
  const n = r.stops.length;
  const stop = r.stops[c];
  const short = stop.name.split(" · ").pop()!;
  const name = child.firstName;
  const pickup = clock(toMin(stop.am));

  if (l.closed) {
    const next = nextSchoolDay(today());
    return { headline: "No bus today", sub: `${l.closed === "Weekend" ? "It's the weekend" : l.closed}. Next pickup is ${fmtWeekday(next)} at ${pickup} from ${stop.name}.` };
  }

  if (l.run === "am" && l.position !== null) {
    const p = l.position;
    const eta = etaAt(r, c, "am", l.delay);
    if (p < c) {
      const away = c - Math.floor(p);
      const mins = Math.max(0, Math.round(eta - nowMin));
      if (skipping) return { headline: `Bus ${r.id} is ${away === 1 ? "1 stop" : `${away} stops`} away`, sub: `You've said ${name} isn't riding today, so it won't wait at ${short}.` };
      return {
        headline: away === 1 ? (mins <= 1 ? `Bus ${r.id} is arriving now` : `Arriving in ${mins} min`) : `Bus ${r.id} is ${away} stops away`,
        sub: `At ${stop.name} around ${clock(eta)}${l.delay > 2 ? ` — running ${l.delay} min behind schedule` : ""}.`,
        eta: clock(eta),
        etaLabel: "At your stop",
      };
    }
    const school = etaAt(r, n - 1, "am", l.delay);
    if (skipping) return { headline: `Bus ${r.id} has passed your stop`, sub: `It left ${short} at ${amLog[c] ? fmtTime(amLog[c]!) : clock(eta)}. ${name} was marked as not riding today.` };
    return {
      headline: `${name} is on the way to school`,
      sub: `Picked up at ${amLog[c] ? fmtTime(amLog[c]!) : clock(eta)} from ${short}. ${n - 1 - Math.floor(p) - 1 > 0 ? `${n - 2 - Math.floor(p)} more ${n - 2 - Math.floor(p) === 1 ? "stop" : "stops"} before school.` : "Pulling in to school now."}`,
      eta: clock(school),
      etaLabel: "At school",
    };
  }

  if (l.run === "pm" && l.position !== null) {
    const p = l.position; // morning order: the bus moves from n-1 down to 0
    const eta = etaAt(r, c, "pm", l.delay);
    if (p > c) {
      const away = Math.ceil(p) - c;
      const mins = Math.max(0, Math.round(eta - nowMin));
      if (skipping) return { headline: `Bus ${r.id} is on its afternoon run`, sub: `${name} isn't on board today, as you told us this morning.` };
      return {
        headline: away === 1 ? (mins <= 1 ? `${name} is almost home` : `Arriving in ${mins} min`) : `${name} is ${away} stops away`,
        sub: `Drop at ${stop.name} around ${clock(eta)}. ${r.attendant} will hand ${child.gender === "F" ? "her" : "him"} over at the stop.`,
        eta: clock(eta),
        etaLabel: "At your stop",
      };
    }
    return { headline: skipping ? `Bus ${r.id} has passed your stop` : `${name} has been dropped`, sub: `${skipping ? "Passed" : "Dropped at"} ${short} at ${pmLog[c] ? fmtTime(pmLog[c]!) : clock(eta)}. The bus is finishing its last stops.` };
  }

  if (l.phase === "done") {
    return {
      headline: "All drops completed",
      sub: skipping ? `${name} didn't take the bus today. Next pickup is ${fmtWeekday(nextSchoolDay(today()))} at ${pickup}.` : `${name} was dropped at ${short} at ${pmLog[c] ? fmtTime(pmLog[c]!) : clock(toMin(stop.pm))}. Next pickup is ${fmtWeekday(nextSchoolDay(today()))} at ${pickup}.`,
    };
  }

  // parked: before the morning run, or at school between runs
  const { start } = runWindow(r, "pm");
  if (amLog[n - 1]) {
    return {
      headline: skipping ? `Bus ${r.id} is parked at school` : `${name} reached school at ${fmtTime(amLog[n - 1]!)}`,
      sub: `The afternoon bus leaves at ${clock(start)} and should reach ${short} around ${clock(toMin(stop.pm))}.`,
      eta: clock(toMin(stop.pm)),
      etaLabel: "Drop at your stop",
    };
  }
  return {
    headline: `Pickup at ${pickup}`,
    sub: `Bus ${r.id} leaves ${r.stops[0].name} at ${clock(toMin(r.stops[0].am))}. We'll alert you when it's two stops away.`,
    eta: pickup,
    etaLabel: "At your stop",
  };
}

function NoTransport({ child }: { child: Student }) {
  const toast = useToast();
  const route = routeForLocality(child.locality);
  return (
    <Card>
      <EmptyState
        icon={<Bus />}
        title={`${child.firstName} isn't on a school bus route`}
        body={
          route
            ? `Route ${route.id} (${route.name}) serves ${child.locality}. The bus costs ${rupees(TRANSPORT_QUARTERLY)} a quarter, billed with fees, and a seat can start from the next quarter.`
            : `No route covers ${child.locality} yet. The transport desk keeps a waiting list and adds stops each April.`
        }
        action={
          <Button
            variant="primary"
            onClick={() => toast({ title: "Request sent to the transport desk", body: "They'll call you within two working days about seats and the nearest stop." })}
          >
            Request a seat
          </Button>
        }
      />
    </Card>
  );
}
