"use client";

import { BriefcaseMedical, Cctv, Download, Gauge, Pause, Phone, Play, RotateCcw, Satellite, ShieldCheck, UserRoundCheck } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlay";
import { PageHeader, Stat } from "@/components/ui/layout";
import { Avatar, Badge, Button, Card, CardHeader, cn, Meter } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { addDays, isoDate, isSchoolDay, lastSchoolDay, today } from "@/lib/data/calendar";
import { studentById } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { ROUTE_BY_ID, ROUTES, type Route } from "@/lib/data/transport";
import { fmtDate, fmtTime, fmtWeekday, number, percent, plural } from "@/lib/format";
import { useAppState } from "@/lib/store";
import { atMinutes, busDetails, clock, etaAt, liveStatus, onRoad, ridersOn, runLog, runWindow, stopCounts, toMin, useTicker, type Live, type Run } from "./live";
import { RouteMap, RouteTrack } from "./RouteMap";

type View = "live" | Run;

export function AdminTransport() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const now = useTicker(5000);
  const absences = useAppState((s) => s.busAbsence);
  const detailRef = useRef<HTMLDivElement>(null);

  const live = useMemo(() => ROUTES.map((r) => ({ r, l: liveStatus(r, now) })), [now]);
  const seats = ROUTES.reduce((a, r) => a + r.capacity, 0);
  const riders = useMemo(() => Object.fromEntries(ROUTES.map((r) => [r.id, ridersOn(r)])), []);
  const totalRiders = Object.values(riders).reduce((a, l) => a + l.length, 0);
  const todayIso = isoDate(today());
  const notRiding = useMemo(
    () =>
      Object.entries(absences)
        .filter(([k]) => k.endsWith(`|${todayIso}`))
        .map(([k, at]) => ({ s: studentById(k.split("|")[0]), at }))
        .filter((x): x is { s: NonNullable<typeof x.s>; at: string } => !!x.s && !!x.s.routeId),
    [absences, todayIso],
  );

  const running = live.filter((x) => onRoad(x.l));
  const late = running.filter((x) => x.l.delay > 2);
  const defaultRoute = (late[0] ?? running[0] ?? live.find((x) => x.r.id === "R6") ?? live[0]).r.id;
  const selectedId = ROUTE_BY_ID[params.get("route") ?? ""] ? params.get("route")! : defaultRoute;
  const select = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("route", id);
    router.replace(`${pathname}?${sp}`, { scroll: false });
    if (window.innerWidth < 1280) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const firstOut = Math.min(...ROUTES.map((r) => toMin(r.stops[0].am)));
  const lastIn = Math.max(...ROUTES.map((r) => toMin(r.stops[0].pm)));
  const anyAm = running.some((x) => x.l.phase === "morning");
  const closed = live[0].l.closed;
  const summary = closed
    ? `No buses today${closed === "Weekend" ? "" : ` — ${closed}`}. Next pickups start at ${clock(firstOut)} on the next school day.`
    : running.length
      ? `${running.length} of ${ROUTES.length} buses are out on the ${anyAm ? "morning pickup" : "afternoon drop"}${late.length ? `, ${late.length} running late` : ", all on time"}.`
      : live.every((x) => x.l.phase === "done")
        ? `All drops completed for today. Tomorrow's first pickup is at ${clock(firstOut)}.`
        : now.getHours() < 8
          ? `Buses leave for the morning pickup from ${clock(firstOut)}.`
          : `All buses are parked at school. Afternoon drops leave at ${clock(toMin(ROUTES[0].stops[ROUTES[0].stops.length - 1].pm))}.`;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full", running.length ? "animate-pulse-dot bg-good" : "bg-faint")} />
            {running.length ? "Live · updated every 5 seconds" : `${fmtWeekday(now)} · ${fmtTime(now)}`}
          </span>
        }
        title="Transport"
        description={summary}
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              toast({ title: "Route manifests are being prepared", body: `${ROUTES.length} PDFs with stop-wise student lists and guardian numbers, for ${fmtDate(today())}.`, tone: "info" })
            }
          >
            <Download /> Today's manifests
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Routes" value={ROUTES.length} sub={`${number(seats)} seats · ${clock(firstOut)} to ${clock(lastIn)}`} />
        <Stat
          label="On the road now"
          value={
            <span>
              {running.length}
              <span className="text-[16px] font-medium text-muted">/{ROUTES.length}</span>
            </span>
          }
          sub={closed ? "No service today" : running.length ? (anyAm ? "Morning pickup" : "Afternoon drop") : "All buses at school or depot"}
        />
        <Stat
          label="Students on transport"
          value={number(totalRiders)}
          sub={`${percent(totalRiders / seats, 0)} of seats filled${notRiding.length ? ` · ${notRiding.length} not riding today` : ""}`}
        />
        <Stat
          label="Running late"
          value={<span className={late.length ? "text-warn" : undefined}>{late.length}</span>}
          sub={late.length ? late.map((x) => `${x.r.id} +${x.l.delay} min`).join(" · ") : running.length ? "Every bus within 2 min of schedule" : "Nothing on the road"}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,8fr)]">
        <Card className="self-start">
          <CardHeader title="Routes" description="Select a route for its stops, crew and the live map" />
          <ul className="border-t border-line">
            {live.map(({ r, l }) => (
              <RouteRow key={r.id} route={r} live={l} riders={riders[r.id].length} selected={r.id === selectedId} onSelect={() => select(r.id)} />
            ))}
          </ul>
        </Card>

        <div ref={detailRef} className="scroll-mt-20">
          <RouteDetail key={selectedId} route={ROUTE_BY_ID[selectedId]} now={now} riders={riders[selectedId].length} notRiding={notRiding.filter((x) => x.s.routeId === selectedId)} />
        </div>
      </div>

      <Safety />
    </>
  );
}

function phaseBadge(l: Live) {
  if (l.closed) return <Badge tone="neutral">No service</Badge>;
  if (onRoad(l))
    return l.delay > 2 ? (
      <Badge tone="warn" dot>{`${l.delay} min late`}</Badge>
    ) : (
      <Badge tone="good" dot>
        On time
      </Badge>
    );
  if (l.phase === "done") return <Badge tone="neutral">Drops done</Badge>;
  return <Badge tone="neutral">Parked</Badge>;
}

function RouteRow({ route: r, live: l, riders, selected, onSelect }: { route: Route; live: Live; riders: number; selected: boolean; onSelect: () => void }) {
  const n = r.stops.length;
  const runPos = l.position === null ? null : l.run === "am" ? l.position : n - 1 - l.position;
  const nextIdx = runPos === null ? null : l.run === "am" ? Math.min(n - 1, Math.floor(l.position!) + 1) : Math.max(0, Math.ceil(l.position!) - 1);
  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn("relative flex w-full gap-3.5 px-5 py-3.5 text-left transition-colors", selected ? "bg-brand-soft/45" : "hover:bg-surface-2")}
      >
        {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-brand" aria-hidden />}
        <span className={cn("tnum grid h-7 w-9 shrink-0 place-items-center rounded-md text-[12px] font-semibold", selected ? "bg-brand text-white" : "bg-ink/[0.06] text-ink-2")}>{r.id}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="truncate text-[13.5px] font-medium text-ink">{r.name}</span>
            {phaseBadge(l)}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {nextIdx !== null && l.run ? `Next: ${r.stops[nextIdx].name} · ${clock(etaAt(r, nextIdx, l.run, l.delay))}` : `${r.bus} · ${riders}/${r.capacity} seats`}
          </span>
          {runPos !== null ? (
            <span className="mt-2.5 flex items-center gap-2.5">
              <span className="relative h-1.5 flex-1 rounded-full bg-ink/[0.07]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${(runPos / (n - 1)) * 100}%` }} />
                {r.stops.map((_, i) => (
                  <span
                    key={i}
                    className={cn("absolute top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-surface", i <= runPos ? "bg-brand" : "bg-line-strong")}
                    style={{ left: `${(i / (n - 1)) * 100}%` }}
                  />
                ))}
              </span>
              <span className="tnum shrink-0 text-[11.5px] text-muted">
                {Math.min(n, Math.floor(runPos) + 1)}/{n}
              </span>
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function RouteDetail({ route: r, now, riders, notRiding }: { route: Route; now: Date; riders: number; notRiding: { s: NonNullable<ReturnType<typeof studentById>>; at: string }[] }) {
  const toast = useToast();
  const n = r.stops.length;
  const [view, setView] = useState<View>("live");
  const replayDay = isSchoolDay(today()) ? today() : lastSchoolDay(today());
  const [simMin, setSimMin] = useState(0);
  const [playing, setPlaying] = useState(false);

  const canReplay = (run: Run) => {
    if (replayDay.getTime() !== today().getTime()) return true;
    return now.getHours() * 60 + now.getMinutes() >= runWindow(r, run).start;
  };

  // start a replay from the top of the run
  useEffect(() => {
    if (view === "live") {
      setPlaying(false);
      return;
    }
    setSimMin(runWindow(r, view).start - 2);
    setPlaying(true);
  }, [view, r]);

  useEffect(() => {
    if (view === "live" || !playing) return;
    const end = runWindow(r, view).end + 6;
    const id = setInterval(() => {
      setSimMin((m) => {
        if (m >= end) {
          setPlaying(false);
          return m;
        }
        return Math.min(end, m + 0.25);
      });
    }, 200);
    return () => clearInterval(id);
  }, [view, playing, r]);

  const t = view === "live" ? now : atMinutes(replayDay, simMin);
  const l = liveStatus(r, t);
  const details = useMemo(() => busDetails(r), [r]);
  const counts = useMemo(() => stopCounts(r), [r]);
  const amLog = useMemo(() => runLog(r, replayDay, "am", now), [r, replayDay, Math.floor(now.getTime() / 60000)]);
  const pmLog = useMemo(() => runLog(r, replayDay, "pm", now), [r, replayDay, Math.floor(now.getTime() / 60000)]);
  const passed = (i: number) => l.position !== null && (l.run === "am" ? i <= l.position : i >= l.position);
  const nextIdx = l.position === null || !l.run ? null : l.run === "am" ? Math.min(n - 1, Math.floor(l.position) + 1) : Math.max(0, Math.ceil(l.position) - 1);
  const win = view !== "live" ? runWindow(r, view) : null;

  const statusLine = l.closed
    ? l.label
    : onRoad(l) && l.run
      ? `${l.run === "am" ? "Morning pickup" : "Afternoon drop"} · next stop ${r.stops[nextIdx!].name} at ${clock(etaAt(r, nextIdx!, l.run, l.delay))}${l.run === "am" ? ` · reaches school ~${clock(etaAt(r, n - 1, "am", l.delay))}` : ` · last drop ~${clock(etaAt(r, 0, "pm", l.delay))}`}`
      : l.phase === "done"
        ? `All drops completed${pmLog[0] ? ` · last drop at ${fmtTime(pmLog[0]!)}` : ""}`
        : l.label.startsWith("Departs")
          ? `Leaves ${r.stops[0].name} at ${clock(toMin(r.stops[0].am))}`
          : `Parked at school${amLog[n - 1] ? ` · reached at ${fmtTime(amLog[n - 1]!)}` : ""} · afternoon run leaves ${clock(toMin(r.stops[n - 1].pm))}`;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="tnum rounded-md bg-brand px-1.5 py-0.5 text-[12px] font-semibold text-white">{r.id}</span>
            {r.name}
          </span>
        }
        description={`${r.bus} · ${details.model} · ${details.year}`}
        action={
          <Segmented<View>
            size="sm"
            label="Map view"
            value={view}
            onChange={(v) =>
              v === "live" || canReplay(v)
                ? setView(v)
                : toast({ title: "That run hasn't started yet", body: `The afternoon run leaves school at ${clock(toMin(r.stops[n - 1].pm))}. You can replay it after that.`, tone: "info" })
            }
            options={[
              { value: "live", label: "Live" },
              { value: "am", label: "Replay AM" },
              { value: "pm", label: "Replay PM" },
            ]}
          />
        }
        className="flex-wrap"
      />

      <div className="px-5">
        <div className="rounded-xl border border-line bg-surface-2 px-4 pt-2 pb-1">
          <div className="hidden sm:block">
            <RouteMap
            route={r}
            position={l.position}
            run={l.run}
            live={view === "live" && onRoad(l)}
            ariaLabel={`Schematic map of route ${r.id}: ${r.stops.map((s) => s.name).join(", ")}`}
            height={156}
          />
          </div>
          <div className="py-3 sm:hidden">
            <RouteTrack
              route={r}
              run={l.run ?? "am"}
              position={l.position}
              live={view === "live" && onRoad(l)}
              times={r.stops.map((st) => clock(toMin((l.run ?? "am") === "am" ? st.am : st.pm) + (onRoad(l) ? l.delay : 0)))}
              rowHeight={50}
            />
          </div>
        </div>
        {view === "live" ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-[12.5px] text-ink-2">
            {phaseBadge(l)}
            <span className="min-w-0">{statusLine}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-3">
            <Button
              size="icon-sm"
              variant="secondary"
              onClick={() => (simMin >= win!.end + 6 ? (setSimMin(win!.start - 2), setPlaying(true)) : setPlaying((p) => !p))}
              aria-label={playing ? "Pause replay" : "Play replay"}
            >
              {playing ? <Pause /> : simMin >= win!.end + 6 ? <RotateCcw /> : <Play />}
            </Button>
            <span className="tnum w-[64px] shrink-0 text-[13px] font-semibold">{fmtTime(t)}</span>
            <input
              type="range"
              aria-label="Replay time"
              min={win!.start - 2}
              max={win!.end + 6}
              step={0.25}
              value={simMin}
              onChange={(e) => {
                setSimMin(Number(e.target.value));
                setPlaying(false);
              }}
              className="h-1.5 min-w-0 flex-1 accent-[var(--brand)]"
            />
            <span className="hidden shrink-0 text-[12px] text-muted sm:inline">
              {replayDay.getTime() === today().getTime() ? "Today" : fmtWeekday(replayDay)} · {view === "am" ? "morning" : "afternoon"} run
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <div className="min-w-0">
          <Table className="min-w-[440px]">
            <THead>
              <tr>
                <Th>Stop</Th>
                <Th align="right">Students</Th>
                <Th align="right">Pickup</Th>
                <Th align="right">Drop</Th>
              </tr>
            </THead>
            <tbody>
              {r.stops.map((s, i) => {
                const isNext = view === "live" && nextIdx === i && onRoad(l);
                const amA = amLog[i];
                const pmA = pmLog[i];
                const amLate = amA ? Math.round((amA.getTime() - atMinutes(replayDay, toMin(s.am)).getTime()) / 60000) : 0;
                const pmLate = pmA ? Math.round((pmA.getTime() - atMinutes(replayDay, toMin(s.pm)).getTime()) / 60000) : 0;
                return (
                  <Tr key={s.name} className={cn("[&>td]:h-auto [&>td]:py-2.5", isNext && "bg-brand-soft/40")}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className={cn("tnum grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold", passed(i) ? "bg-brand text-white" : "bg-ink/[0.06] text-ink-2")}>
                          {i === n - 1 ? "S" : i + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{i === n - 1 ? "School" : s.name}</span>
                          {isNext && <span className="block text-[11.5px] text-brand">Next stop</span>}
                        </span>
                      </div>
                    </Td>
                    <Td align="right" className="text-ink-2">
                      {i === n - 1 ? "—" : counts[i]}
                    </Td>
                    <Td align="right">
                      <span className="text-ink">{clock(toMin(s.am))}</span>
                      {amA && (
                        <span className={cn("block text-[11.5px]", amLate > 2 ? "text-warn" : "text-muted")}>
                          {fmtTime(amA)}
                          {amLate > 0 ? ` · +${amLate}` : ""}
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="text-ink">{clock(toMin(s.pm))}</span>
                      {pmA && (
                        <span className={cn("block text-[11.5px]", pmLate > 2 ? "text-warn" : "text-muted")}>
                          {fmtTime(pmA)}
                          {pmLate > 0 ? ` · +${pmLate}` : ""}
                        </span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <p className="border-t border-line px-5 py-2.5 text-[11.5px] text-muted">Scheduled times; the actual time recorded by the bus's GPS today is shown beneath.</p>
        </div>

        <aside className="grid grid-cols-1 gap-px border-t border-line bg-line md:grid-cols-3">
          <section className="bg-surface px-5 py-4">
            <p className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">Crew</p>
            <Crew name={r.driver} role="Driver" phone={r.driverPhone} />
            <Crew name={r.attendant} role="Attendant" phone={details.attendantPhone} />
          </section>

          <section className="bg-surface px-5 py-4">
            <p className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">Seats</p>
            <div className="mt-2.5 flex items-baseline justify-between text-[13px]">
              <span>
                <span className="tnum font-semibold text-ink">{riders}</span> <span className="text-muted">of {r.capacity} assigned</span>
              </span>
              <span className="tnum text-[12px] text-muted">{plural(r.capacity - riders, "seat")} free</span>
            </div>
            <Meter value={riders / r.capacity} className="mt-2" label="Seats assigned" tone={riders / r.capacity > 0.95 ? "warn" : "brand"} />
            <p className="mt-2.5 text-[12px] leading-snug text-muted">
              {details.model} · {notRiding.length ? `${plural(notRiding.length, "student")} not riding today` : "everyone riding today"}
            </p>
          </section>

          <section className="bg-surface px-5 py-4">
            <p className="text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">Papers</p>
            <ul className="mt-1.5 text-[12.5px]">
              {details.docs.map((d) => {
                const due = addDays(today(), d.inDays);
                return (
                  <li key={d.label} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-ink-2">{d.label}</span>
                    {d.inDays <= 30 ? <Badge tone="warn">Renew by {fmtDate(due).replace(/ \d{4}$/, "")}</Badge> : <span className="tnum text-muted">till {fmtDate(due)}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      <div className="border-t border-line px-5 py-3.5">
        <p className="text-[12.5px] font-medium text-ink">Not riding today</p>
        {notRiding.length === 0 ? (
          <p className="mt-0.5 text-[12.5px] text-muted">No absences reported by parents on this route.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {notRiding.map(({ s, at }) => (
              <li key={s.id} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pr-3 pl-1 text-[12.5px]">
                <Avatar name={s.name} size={22} />
                <span className="font-medium">{s.name}</span>
                <span className="text-muted">
                  {classLabel(s.grade, s.section)} · reported {fmtTime(new Date(at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Crew({ name, role, phone }: { name: string; role: string; phone: string }) {
  return (
    <div className="mt-2.5 flex items-center gap-3">
      <Avatar name={name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{name}</p>
        <p className="tnum truncate text-[12px] text-muted">
          {role} · {phone.replace("+91 ", "")}
        </p>
      </div>
      <a
        href={`tel:${phone.replace(/\s/g, "")}`}
        aria-label={`Call ${name}`}
        className="grid size-8 shrink-0 place-items-center rounded-lg border border-line-strong/80 text-ink-2 hover:bg-surface-2 hover:text-ink"
      >
        <Phone className="size-3.5" />
      </a>
    </div>
  );
}

const SAFETY = [
  { icon: <Satellite />, title: "GPS on every bus", body: "Position every 10 seconds. Parents are alerted two stops before theirs, and the office if a bus stops for over 4 minutes." },
  { icon: <Cctv />, title: "CCTV, front and rear", body: "Two cameras per bus, footage kept for 30 days and reviewed after any complaint." },
  { icon: <UserRoundCheck />, title: "Woman attendant on each trip", body: "Juniors are handed over only to a registered guardian, checked against the photo on the app." },
  { icon: <Gauge />, title: "Speed governor at 40 km/h", body: "Fitted and sealed, as the Supreme Court's school-bus guidelines require. Overspeed alerts go to the transport in-charge." },
  { icon: <BriefcaseMedical />, title: "First aid and fire extinguisher", body: "Checked on the 1st of every month. All crew are trained in first aid each April." },
  { icon: <ShieldCheck />, title: "Verified crew", body: "Police verification, a heavy-vehicle licence with 5+ years' driving, and an annual medical for every driver." },
];

function Safety() {
  return (
    <Card className="mt-4">
      <CardHeader title="Safety on every route" description="What a parent can count on, whichever bus their child takes" icon={<ShieldCheck />} />
      <ul className="grid grid-cols-1 gap-px overflow-hidden border-t border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
        {SAFETY.map((s) => (
          <li key={s.title} className="flex gap-3 bg-surface px-5 py-4">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-4">{s.icon}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{s.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
