"use client";

import { Bell, CheckCircle2, Clock3, Mail, Megaphone, MessageCircle, MessageSquareText, PenSquare, Pin, SearchX, Send, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SearchInput, Select, Tabs } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlay";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { Badge, Button, Card, CardFooter, CardHeader, cn, Meter } from "@/components/ui/primitives";
import { fmtDay, fmtTime, fmtWeekday, number, percent, plural, relativeDays } from "@/lib/format";
import { PERSONAS, useRole } from "@/lib/session";
import { getState, setState, useAppState } from "@/lib/store";
import { scopeOf } from "@/components/comms/audience";
import { ComposeDialog } from "./ComposeDialog";
import { NoticeSheet } from "./NoticeSheet";
import { boardNotices, CATEGORIES, categoryTone, channelsOf, isConsent, isFresh, isScheduled, reachOf, type BoardNotice, type Reach } from "./model";

export const TEACHER_AUTHOR = "Ms. Kavya Iyer, Class teacher VIII-B";
const ADMIN_AUTHOR = "Dr. Meenakshi Rao, Principal";

type AudienceFilter = "all" | "school" | "classes" | "staff" | "routes";

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function audienceBucket(n: BoardNotice): AudienceFilter {
  const s = scopeOf(n);
  if (!s.parents) return "staff";
  if (s.routeId) return "routes";
  if (s.classKey || s.grades) return "classes";
  return "school";
}

export function NoticeBoard() {
  const role = useRole();
  const isAdmin = role === "admin";
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const now = useNow();
  const posted = useAppState((s) => s.notices);
  const acks = useAppState((s) => s.acks);
  const nudges = useAppState((s) => s.nudges);

  const [tab, setTab] = useState<"all" | "response" | "scheduled" | "staff" | "mine">("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [audience, setAudience] = useState<AudienceFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const composeOpen = params.get("compose") === "1";
  const setCompose = (open: boolean) => router.replace(open ? `${pathname}?compose=1` : pathname, { scroll: false });

  const all = useMemo(() => {
    const list = boardNotices();
    // teachers don't see other people's notices before they go out
    return isAdmin ? list : list.filter((n) => !isScheduled(n, now) || n.author === TEACHER_AUTHOR);
  }, [posted, isAdmin, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const reach = useMemo(() => new Map(all.map((n) => [n.id, reachOf(n, now, acks)])), [all, now, acks]);
  const mine = (n: BoardNotice) => n.author === TEACHER_AUTHOR;

  const counts = {
    all: all.length,
    response: all.filter((n) => n.requiresAck && !isScheduled(n, now)).length,
    scheduled: all.filter((n) => isScheduled(n, now)).length,
    staff: all.filter((n) => scopeOf(n).staff).length,
    mine: all.filter(mine).length,
  };

  const shown = all.filter((n) => {
    if (tab === "response" && !(n.requiresAck && !isScheduled(n, now))) return false;
    if (tab === "scheduled" && !isScheduled(n, now)) return false;
    if (tab === "staff" && !scopeOf(n).staff) return false;
    if (tab === "mine" && !mine(n)) return false;
    if (category !== "all" && n.category !== category) return false;
    if (audience !== "all" && audienceBucket(n) !== audience) return false;
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      if (![n.title, n.body, n.audience, n.author].some((x) => x.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const filtered = q.trim() !== "" || category !== "all" || audience !== "all";
  const clearFilters = () => {
    setQ("");
    setCategory("all");
    setAudience("all");
  };

  const open = all.find((n) => n.id === openId) ?? null;

  // ——— admin summary ———
  const summary = useMemo(() => {
    const month = all.filter((n) => !isScheduled(n, now) && now.getTime() - n.postedAt.getTime() < 30 * 86400000);
    // notices still in their first day are excluded: most families haven't had the chance to open them
    const settled = month.filter((n) => now.getTime() - n.postedAt.getTime() > 86400000);
    const rates = settled.map((n) => reach.get(n.id)!).filter((r) => r.total > 0).map((r) => r.read / r.total);
    const awaiting = month.filter((n) => n.requiresAck);
    const parentAsks = awaiting.filter((n) => scopeOf(n).parents);
    return {
      month,
      avgRead: rates.reduce((a, b) => a + b, 0) / (rates.length || 1),
      awaiting,
      parentAsks,
      pendingFamilies: parentAsks.reduce((a, n) => a + reach.get(n.id)!.pending, 0),
      pendingStaff: awaiting.filter((n) => !scopeOf(n).parents).reduce((a, n) => a + reach.get(n.id)!.pending, 0),
    };
  }, [all, reach, now]);

  return (
    <>
      <PageHeader
        title="Notices"
        description={isAdmin ? "Circulars to parents and staff, and who has actually read them." : "From the principal's office and the school, plus your own messages to VIII-B parents."}
        actions={
          isAdmin ? (
            <Button variant="primary" onClick={() => setCompose(true)}>
              <PenSquare /> Compose notice
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setCompose(true)}>
              <Megaphone /> Message VIII-B parents
            </Button>
          )
        }
      />

      {isAdmin && (
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Sent in the last 30 days" value={summary.month.length} sub={`${plural(summary.awaiting.length, "needs", "need")} a response`} />
          <Stat label="Average read rate" value={percent(summary.avgRead)} sub="opened within a day, in the app, SMS or email" />
          <Stat
            label="Awaiting responses"
            value={number(summary.pendingFamilies)}
            sub={`families across ${plural(summary.parentAsks.length, "notice")}${summary.pendingStaff ? ` · ${summary.pendingStaff} staff` : ""}`}
          />
          <Stat
            label="Families on the app"
            value="92.3%"
            sub="112 families get SMS instead"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <div className="px-5 pt-1">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={
                isAdmin
                  ? [
                      { value: "all", label: "All notices", count: counts.all },
                      { value: "response", label: "Needs a response", count: counts.response },
                      ...(counts.scheduled ? [{ value: "scheduled" as const, label: "Scheduled", count: counts.scheduled }] : []),
                    ]
                  : [
                      { value: "all", label: "All notices", count: counts.all },
                      { value: "staff", label: "For staff", count: counts.staff },
                      { value: "mine", label: "Sent by me", count: counts.mine },
                    ]
              }
            />
          </div>
          <div className="flex flex-col gap-2 border-b border-line px-5 py-3 sm:flex-row sm:items-center">
            <SearchInput value={q} onChange={setQ} placeholder="Search notices" className="sm:max-w-[280px] sm:flex-1" />
            <div className="flex gap-2">
              <Select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="min-w-0 flex-1 sm:flex-none">
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Select aria-label="Audience" value={audience} onChange={(e) => setAudience(e.target.value as AudienceFilter)} className="min-w-0 flex-1 sm:flex-none">
                <option value="all">All audiences</option>
                <option value="school">Whole school</option>
                <option value="classes">Classes & stages</option>
                <option value="staff">Staff</option>
                <option value="routes">Bus routes</option>
              </Select>
            </div>
          </div>

          {shown.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={<SearchX />}
                title={q.trim() ? `No notices match "${q.trim()}"` : "No notices match these filters"}
                body="Try a different category or audience, or search by a word from the title."
                action={
                  <Button size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : tab === "mine" ? (
              <EmptyState
                icon={<Megaphone />}
                title="You haven't messaged VIII-B parents yet"
                body="Reminders about tests, things to bring, or a change in plans. Parents see it in the app within a minute."
                action={
                  <Button size="sm" variant="primary" onClick={() => setCompose(true)}>
                    Write to VIII-B parents
                  </Button>
                }
              />
            ) : tab === "scheduled" ? (
              <EmptyState icon={<Clock3 />} title="Nothing scheduled" body="Notices you schedule for later wait here until they go out." />
            ) : (
              <EmptyState icon={<CheckCircle2 />} title="Nothing waiting on parents" body="Notices that ask for an acknowledgement or consent show up here with their response counts." />
            )
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((n) => (
                <NoticeRow key={n.id} n={n} r={reach.get(n.id)!} now={now} showReach={isAdmin || mine(n)} onOpen={() => setOpenId(n.id)} />
              ))}
            </ul>
          )}
          <CardFooter>
            <span>
              Showing {shown.length} of {all.length}
            </span>
            <span className="hidden sm:inline">Read receipts update as families open the app</span>
          </CardFooter>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          {isAdmin ? (
            <>
              <AwaitingCard list={summary.awaiting} reach={reach} nudges={nudges} onOpen={setOpenId} onNudge={(n, r) => {
                setState({ nudges: { ...getState().nudges, [`notice:${n.id}`]: new Date().toISOString() } });
                toast({ title: `Reminder sent to ${plural(r.pending, "family", "families")}`, body: `${n.title} · by SMS and WhatsApp with the response link.` });
              }} />
              <DeliveryCard month={summary.month} reach={reach} />
            </>
          ) : (
            <>
              <StaffResponseCard list={all.filter((n) => n.requiresAck && !scopeOf(n).parents)} acks={acks} onOpen={setOpenId} />
              <MyMessagesCard list={all.filter(mine)} reach={reach} now={now} onOpen={setOpenId} onCompose={() => setCompose(true)} />
            </>
          )}
        </div>
      </div>

      <NoticeSheet notice={open} onClose={() => setOpenId(null)} now={now} canNudge={Boolean(open && (isAdmin || mine(open)))} canAck={!isAdmin && Boolean(open && !scopeOf(open).parents)} />
      <ComposeDialog open={composeOpen} onClose={() => setCompose(false)} mode={isAdmin ? "admin" : "teacher"} author={isAdmin ? ADMIN_AUTHOR : TEACHER_AUTHOR} />
    </>
  );
}

function NoticeRow({ n, r, now, showReach, onOpen }: { n: BoardNotice; r: Reach; now: Date; showReach: boolean; onOpen: () => void }) {
  const scheduled = isScheduled(n, now);
  const fresh = n.posted && !scheduled && now.getTime() - n.postedAt.getTime() < 6 * 3600000;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn("grid w-full gap-x-8 gap-y-3 px-5 py-4 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2", showReach && "lg:grid-cols-[minmax(0,1fr)_224px]", n.pinned && "bg-[color-mix(in_oklab,var(--brand-soft)_35%,var(--surface))]")}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
            {n.pinned && (
              <span className="inline-flex items-center gap-1 font-medium text-brand">
                <Pin className="size-3" /> Pinned
              </span>
            )}
            <Badge tone={categoryTone(n.category)}>{n.category}</Badge>
            {fresh && <Badge tone="good" dot>Just sent</Badge>}
            {scheduled && (
              <Badge tone="info">
                <Clock3 className="size-3" /> {fmtWeekday(n.postedAt)}, {fmtTime(n.postedAt)}
              </Badge>
            )}
            <span className="min-w-0 truncate">{n.audience}</span>
          </div>
          <p className="mt-2 text-[14px] leading-snug font-semibold text-ink">{n.title}</p>
          <p className="mt-1 line-clamp-1 text-[12.5px] text-muted">{n.body}</p>
          <p className="mt-2 text-[12px] text-faint">
            {n.author} · {scheduled ? "scheduled" : relativeDays(n.postedAt, now) === "Today" ? `today, ${fmtTime(n.postedAt)}` : relativeDays(n.postedAt, now).replace(/^./, (c) => c.toLowerCase())}
          </p>
        </div>
        {showReach && (
          <div className="self-center">
            {scheduled ? (
              <p className="text-[12px] text-muted">
                Goes to <span className="tnum font-medium text-ink-2">{number(r.total)}</span> {scopeOf(n).parents ? "families" : "staff"} {relativeDays(n.postedAt, now).toLowerCase()}
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                <ReachLine label="Read" value={r.read} total={r.total} tone="brand" />
                {n.requiresAck && <ReachLine label={isConsent(n) ? "Consented" : "Acknowledged"} value={r.acked} total={r.total} tone="good" />}
              </div>
            )}
          </div>
        )}
      </button>
    </li>
  );
}

function ReachLine({ label, value, total, tone }: { label: string; value: number; total: number; tone: "brand" | "good" }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
        <span className="text-muted">{label}</span>
        <span className="tnum text-ink-2">
          <span className="font-semibold text-ink">{number(value)}</span> of {number(total)}
        </span>
      </div>
      <Meter value={value / (total || 1)} tone={tone} label={`${label} ${value} of ${total}`} />
    </div>
  );
}

function AwaitingCard({ list, reach, nudges, onOpen, onNudge }: { list: BoardNotice[]; reach: Map<string, Reach>; nudges: Record<string, string>; onOpen: (id: string) => void; onNudge: (n: BoardNotice, r: Reach) => void }) {
  return (
    <Card>
      <CardHeader title="Awaiting responses" description="Acknowledgements and consent forms still open" />
      {list.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-muted">No notice is waiting on parents right now.</p>
      ) : (
        <ul className="border-t border-line">
          {list.map((n) => {
            const r = reach.get(n.id)!;
            const at = nudges[`notice:${n.id}`];
            return (
              <li key={n.id} className="border-b border-line px-5 py-3.5 last:border-b-0">
                <button type="button" onClick={() => onOpen(n.id)} className="block w-full text-left">
                  <p className="truncate text-[13px] font-medium text-ink hover:underline">{n.title}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{n.audience}</p>
                </button>
                <div className="mt-2.5 flex items-center gap-3">
                  <Meter value={r.acked / (r.total || 1)} tone="good" className="flex-1" label="Responded" />
                  <span className="tnum shrink-0 text-[12px] text-ink-2">
                    <span className="font-semibold text-ink">{number(r.acked)}</span>/{number(r.total)}
                  </span>
                </div>
                <div className="mt-2 flex min-h-8 items-center justify-between gap-2">
                  <span className="text-[12px] text-muted">{at ? `Reminded ${relativeDays(new Date(at), new Date()) === "Today" ? fmtTime(new Date(at)) : fmtDay(new Date(at))}` : `${number(r.pending)} yet to respond`}</span>
                  {isFresh(n, new Date()) ? (
                    <span className="text-[12px] text-faint">Sent just now</span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onNudge(n, r)} className="-mr-2 text-brand">
                      <Send /> {at ? "Remind again" : "Remind"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const CHANNEL_ROWS = [
  { id: "App", label: "App push", icon: <Bell />, delivered: 0.984, engaged: 0.81 },
  { id: "WhatsApp", label: "WhatsApp", icon: <MessageCircle />, delivered: 0.967, engaged: 0.88 },
  { id: "SMS", label: "SMS", icon: <MessageSquareText />, delivered: 0.991, engaged: 0.34 },
  { id: "Email", label: "Email", icon: <Mail />, delivered: 0.979, engaged: 0.41 },
] as const;

function DeliveryCard({ month, reach }: { month: BoardNotice[]; reach: Map<string, Reach> }) {
  const sent = (ch: string) => month.filter((n) => channelsOf(n).includes(ch as never)).reduce((a, n) => a + (reach.get(n.id)?.total ?? 0), 0);
  return (
    <Card>
      <CardHeader title="Delivery by channel" description="Messages sent in the last 30 days" />
      <div className="px-5 pb-2">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[11px] text-muted">
              <th scope="col" className="pb-2 text-left font-medium">Channel</th>
              <th scope="col" className="pb-2 text-right font-medium">Sent</th>
              <th scope="col" className="pb-2 text-right font-medium">Delivered</th>
              <th scope="col" className="pb-2 text-right font-medium">Opened</th>
            </tr>
          </thead>
          <tbody>
            {CHANNEL_ROWS.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="py-2.5">
                  <span className="flex items-center gap-2 font-medium text-ink [&_svg]:size-3.5 [&_svg]:text-muted">
                    {c.icon} {c.label}
                  </span>
                </td>
                <td className="tnum py-2.5 text-right text-ink-2">{number(sent(c.id))}</td>
                <td className="tnum py-2.5 text-right text-ink-2">{percent(c.delivered)}</td>
                <td className="tnum py-2.5 text-right text-ink-2">{percent(c.engaged, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardFooter>
        <span className="flex items-center gap-1.5">
          <UsersRound className="size-3.5" /> Families without the app get every notice by SMS.
        </span>
      </CardFooter>
    </Card>
  );
}

function StaffResponseCard({ list, acks, onOpen }: { list: BoardNotice[]; acks: Record<string, string>; onOpen: (id: string) => void }) {
  const open = list.filter((n) => !acks[n.id]);
  return (
    <Card>
      <CardHeader title="Needs your response" description="Staff notices the office has asked you to confirm" />
      {open.length === 0 ? (
        <div className="flex items-center gap-3 px-5 pb-5">
          <span className="grid size-8 place-items-center rounded-full bg-good-soft text-good">
            <CheckCircle2 className="size-4" />
          </span>
          <p className="text-[13px] text-ink-2">You&apos;re all caught up.</p>
        </div>
      ) : (
        <ul className="border-t border-line">
          {open.map((n) => (
            <li key={n.id} className="border-b border-line px-5 py-3.5 last:border-b-0">
              <button type="button" onClick={() => onOpen(n.id)} className="block w-full text-left">
                <p className="text-[13px] leading-snug font-medium text-ink hover:underline">{n.title}</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {n.author} · {fmtDay(n.postedAt)}
                </p>
              </button>
              <Button size="sm" variant="primary" className="mt-2.5" onClick={() => setState({ acks: { ...getState().acks, [n.id]: new Date().toISOString() } })}>
                Acknowledge
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function MyMessagesCard({ list, reach, now, onOpen, onCompose }: { list: BoardNotice[]; reach: Map<string, Reach>; now: Date; onOpen: (id: string) => void; onCompose: () => void }) {
  return (
    <Card>
      <CardHeader title="Your messages to VIII-B" description={`${PERSONAS.teacher.name} · 37 families`} />
      {list.length === 0 ? (
        <div className="px-5 pb-5">
          <p className="text-[13px] text-muted">Nothing sent this term. A short note before a test or a trip gets read by most parents within the hour.</p>
          <Button size="sm" className="mt-3" onClick={onCompose}>
            <Megaphone /> Write to parents
          </Button>
        </div>
      ) : (
        <ul className="border-t border-line">
          {list.map((n) => {
            const r = reach.get(n.id)!;
            const scheduled = isScheduled(n, now);
            return (
              <li key={n.id} className="border-b border-line last:border-b-0">
                <button type="button" onClick={() => onOpen(n.id)} className="block w-full px-5 py-3.5 text-left hover:bg-surface-2">
                  <p className="truncate text-[13px] font-medium text-ink">{n.title}</p>
                  {scheduled ? (
                    <p className="mt-1 text-[12px] text-muted">
                      Scheduled for {fmtWeekday(n.postedAt)}, {fmtTime(n.postedAt)}
                    </p>
                  ) : (
                    <div className="mt-2 flex items-center gap-3">
                      <Meter value={r.read / (r.total || 1)} className="flex-1" label="Read" />
                      <span className="tnum shrink-0 text-[12px] text-muted">
                        Read by <span className="font-semibold text-ink">{r.read}</span> of {r.total}
                      </span>
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
