"use client";

import { Bell, CheckCircle2, Clock3, Mail, MessageCircle, MessageSquareText, Pin, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/forms";
import { Dialog, useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, cn, Meter } from "@/components/ui/primitives";
import { studentsInClass } from "@/lib/data/people";
import { fmtDay, fmtTime, fmtWeekday, fmtWeekdayLong, number, percent, plural } from "@/lib/format";
import { getState, setState, useAppState } from "@/lib/store";
import { scopeOf } from "@/components/comms/audience";
import { ackLabel } from "./FeedCard";
import { categoryTone, channelsOf, familyReceipts, isConsent, isFresh, isScheduled, reachOf, receiptsByGroup, type BoardNotice, type Channel } from "./model";

const CH_ICON: Record<Channel, React.ReactNode> = {
  App: <Bell />,
  SMS: <MessageSquareText />,
  WhatsApp: <MessageCircle />,
  Email: <Mail />,
};

export function NoticeSheet({ notice, onClose, now, canNudge, canAck }: { notice: BoardNotice | null; onClose: () => void; now: Date; canNudge: boolean; canAck: boolean }) {
  return (
    <Dialog open={Boolean(notice)} onClose={onClose} side title="Notice" description={notice ? `${notice.audience}` : undefined}>
      {notice && <SheetBody n={notice} now={now} canNudge={canNudge} canAck={canAck} />}
    </Dialog>
  );
}

function SheetBody({ n, now, canNudge, canAck }: { n: BoardNotice; now: Date; canNudge: boolean; canAck: boolean }) {
  const toast = useToast();
  const acks = useAppState((s) => s.acks);
  const nudges = useAppState((s) => s.nudges);
  const r = reachOf(n, now, acks);
  const scope = scopeOf(n);
  const scheduled = isScheduled(n, now);
  const channels = channelsOf(n);
  const [filter, setFilter] = useState<"all" | "pending">("all");

  const groups = useMemo(() => (scope.classKey ? [] : receiptsByGroup(n, r)), [n, r.read, r.acked, scope.classKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const families = useMemo(() => (scope.classKey ? familyReceipts(n, r, studentsInClass(scope.classKey)) : []), [n, r.read, r.acked, scope.classKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const nudgedAt = nudges[`notice:${n.id}`];
  const outstanding = n.requiresAck ? r.total - r.acked : r.total - r.read;

  const nudge = () => {
    setState({ nudges: { ...getState().nudges, [`notice:${n.id}`]: new Date().toISOString() } });
    toast({
      title: `Reminder sent to ${plural(outstanding, scope.parents ? "family" : "person", scope.parents ? "families" : "people")}`,
      body: n.requiresAck ? "By SMS and WhatsApp, with the Acknowledge link." : "By SMS, to everyone who hasn't opened it in the app.",
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={categoryTone(n.category)}>{n.category}</Badge>
          {n.pinned && (
            <Badge tone="outline">
              <Pin className="size-3" /> Pinned
            </Badge>
          )}
          {scheduled && (
            <Badge tone="info">
              <Clock3 className="size-3" /> Scheduled
            </Badge>
          )}
          {n.requiresAck && <Badge tone="neutral">{isConsent(n) ? "Consent needed" : "Acknowledgement needed"}</Badge>}
        </div>
        <h3 className="mt-3 text-[18px] leading-snug font-semibold text-ink">{n.title}</h3>
        <p className="mt-1.5 text-[12.5px] text-muted">
          {n.author} · {scheduled ? `goes out ${fmtWeekday(n.postedAt)} at ${fmtTime(n.postedAt)}` : `${fmtWeekdayLong(n.postedAt)}, ${fmtTime(n.postedAt)}`}
        </p>
        <p className="mt-4 text-[13.5px] leading-[1.65] whitespace-pre-line text-ink-2">{n.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] text-muted">Sent by</span>
          {channels.map((c) => (
            <span key={c} className="inline-flex h-6 items-center gap-1 rounded-md border border-line px-1.5 text-[11.5px] text-ink-2 [&_svg]:size-3 [&_svg]:text-muted">
              {CH_ICON[c]} {c === "App" ? "App push" : c}
            </span>
          ))}
        </div>
        {canAck && n.requiresAck && (
          <div className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3">
            {acks[n.id] ? (
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-good">
                <CheckCircle2 className="size-4" /> {ackLabel(n, acks[n.id])}
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink-2">The office has asked staff to confirm.</p>
                <Button variant="primary" size="sm" onClick={() => setState({ acks: { ...getState().acks, [n.id]: new Date().toISOString() } })}>
                  Acknowledge
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {scheduled ? (
        <div className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center">
          <p className="text-[13px] font-medium text-ink">Not sent yet</p>
          <p className="mt-1 text-[12.5px] text-muted">
            {number(r.total)} {scope.parents ? "families" : "staff"} will receive it on {fmtWeekdayLong(n.postedAt)} at {fmtTime(n.postedAt)}. Read receipts appear here once it goes out.
          </p>
          {n.posted && (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setState({ notices: getState().notices.map((x) => (x.id === n.id ? { ...x, postedAt: new Date().toISOString(), scheduled: undefined } : x)) });
                toast({ title: "Sent now", body: `${n.title} is on its way to ${number(r.total)} ${scope.parents ? "families" : "staff"}.` });
              }}
            >
              <Send /> Send now instead
            </Button>
          )}
        </div>
      ) : (
        <>
          <section>
            <h4 className="eyebrow mb-3">Reach</h4>
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              <Figure k="Delivered" v={number(r.total)} sub={scope.parents ? "families" : "staff"} />
              <Figure k="Read" v={number(r.read)} sub={percent(r.read / (r.total || 1), 0)} />
              {n.requiresAck ? <Figure k={isConsent(n) ? "Consented" : "Acknowledged"} v={number(r.acked)} sub={percent(r.acked / (r.total || 1), 0)} /> : <Figure k="Not opened" v={number(r.total - r.read)} sub={percent((r.total - r.read) / (r.total || 1), 0)} />}
            </dl>
            <Meter value={(n.requiresAck ? r.acked : r.read) / (r.total || 1)} tone={n.requiresAck ? "good" : "brand"} className="mt-3" label={n.requiresAck ? "Acknowledged" : "Read"} />
            {canNudge && outstanding > 0 && isFresh(n, now) && <p className="mt-3 text-[12.5px] text-muted">Sent {Math.max(1, Math.round((now.getTime() - n.postedAt.getTime()) / 60000))} min ago. Most families open a notice within the hour; you can remind the rest after that.</p>}
            {canNudge && outstanding > 0 && !isFresh(n, now) && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[12.5px] text-muted">
                  {nudgedAt ? `Reminded ${fmtDay(new Date(nudgedAt))}, ${fmtTime(new Date(nudgedAt))}` : `${number(outstanding)} ${n.requiresAck ? "yet to respond" : "haven't opened it"}`}
                </p>
                <Button size="sm" variant="secondary" onClick={nudge}>
                  <Send /> {nudgedAt ? "Remind again" : `Remind ${number(outstanding)}`}
                </Button>
              </div>
            )}
          </section>

          {groups.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h4 className="eyebrow">Read receipts by {scope.staff && !scope.parents ? "department" : scope.routeId ? "class on the route" : "class"}</h4>
                <span className="text-[11.5px] text-muted">Amber: well below the overall rate</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-surface-2 text-[11px] font-semibold text-muted">
                    <tr>
                      <th scope="col" className="h-8 px-3 text-left font-semibold">{scope.staff && !scope.parents ? "Department" : "Class"}</th>
                      <th scope="col" className="h-8 px-2 text-right font-semibold">Read</th>
                      {n.requiresAck && <th scope="col" className="h-8 px-2 text-right font-semibold">{isConsent(n) ? "Consent" : "Ack."}</th>}
                      <th scope="col" className="h-8 w-[30%] px-3 text-left font-semibold">
                        <span className="sr-only">Rate</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => {
                      const rate = (n.requiresAck ? g.acked : g.read) / (g.total || 1);
                      const overall = (n.requiresAck ? r.acked : r.read) / (r.total || 1);
                      return (
                        <tr key={g.key} className="border-t border-line">
                          <td className="h-9 px-3">
                            <span className="font-medium text-ink">{g.label}</span>
                          </td>
                          <td className="tnum px-2 text-right text-ink-2">
                            {g.read}
                            <span className="text-faint">/{g.total}</span>
                          </td>
                          {n.requiresAck && <td className="tnum px-2 text-right text-ink-2">{g.acked}</td>}
                          <td className="px-3">
                            <div className="flex items-center gap-2">
                              <Meter value={rate} tone={rate < overall - 0.08 ? "warn" : n.requiresAck ? "good" : "brand"} className="flex-1" label={`${g.label} rate`} />
                              <span className="tnum w-8 text-right text-[11.5px] text-muted">{Math.round(rate * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {families.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="eyebrow">Families · {families.length}</h4>
                <Segmented
                  size="sm"
                  value={filter}
                  onChange={setFilter}
                  label="Filter families"
                  options={[
                    { value: "all", label: "All" },
                    { value: "pending", label: n.requiresAck ? "Not responded" : "Not read", count: families.filter((f) => (n.requiresAck ? !f.acked : !f.read)).length },
                  ]}
                />
              </div>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {families
                  .filter((f) => filter === "all" || (n.requiresAck ? !f.acked : !f.read))
                  .map((f) => (
                    <li key={f.student.id} className="flex items-center gap-3 px-3 py-2">
                      <Avatar name={f.student.name} size={28} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{f.student.name}</p>
                        <p className="truncate text-[11.5px] text-muted">
                          {f.student.guardians[0].name} · Roll {f.student.roll}
                        </p>
                      </div>
                      {f.acked ? (
                        <Badge tone="good">{isConsent(n) ? "Consented" : "Acknowledged"}</Badge>
                      ) : f.read ? (
                        <span className="text-[11.5px] text-muted">Read {f.at ? fmtTime(f.at) : ""}</span>
                      ) : (
                        <Badge tone="warn">Not opened</Badge>
                      )}
                    </li>
                  ))}
                {families.filter((f) => filter === "all" || (n.requiresAck ? !f.acked : !f.read)).length === 0 && (
                  <li className="px-3 py-6 text-center text-[12.5px] text-muted">Every family has {n.requiresAck ? "responded" : "read it"}.</li>
                )}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Figure({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <dt className="text-[11.5px] text-muted">{k}</dt>
      <dd className={cn("tnum mt-0.5 text-[17px] font-semibold text-ink")}>{v}</dd>
      <dd className="text-[11.5px] text-muted">{sub}</dd>
    </div>
  );
}
