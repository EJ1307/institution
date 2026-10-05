"use client";

import { BellOff, CheckCheck, CheckCircle2, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog, useToast } from "@/components/ui/overlay";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Badge, Button, cn } from "@/components/ui/primitives";
import type { Student } from "@/lib/data/people";
import { classLabel } from "@/lib/data/school";
import { fmtTime, fmtWeekdayLong } from "@/lib/format";
import { useChild } from "@/lib/session";
import { getState, setState, useAppState } from "@/lib/store";
import { childrenReached, scopeOf } from "@/components/comms/audience";
import { ackLabel, FeedCard } from "./FeedCard";
import { boardNotices, CATEGORIES, categoryTone, isConsent, isScheduled, type BoardNotice } from "./model";
import { useNow } from "./NoticeBoard";

type Chip = "all" | "unread" | "response" | (typeof CATEGORIES)[number];

/** Older notices count as already seen, so the demo opens with a believable unread count. */
const SEEN_AFTER_DAYS = 5;

export function ParentNotices() {
  const { children } = useChild();
  const toast = useToast();
  const now = useNow();
  const posted = useAppState((s) => s.notices);
  const acks = useAppState((s) => s.acks);
  const reads = useAppState((s) => s.noticesRead);
  const [chip, setChip] = useState<Chip>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const feed = useMemo(
    () =>
      boardNotices()
        .filter((n) => !isScheduled(n, now))
        .map((n) => ({ n, kids: childrenReached(scopeOf(n), children) }))
        .filter((x) => x.kids.length > 0),
    [posted, children, now], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isUnread = (n: BoardNotice) => !reads[n.id] && !acks[n.id] && now.getTime() - n.postedAt.getTime() < SEEN_AFTER_DAYS * 86400000;
  const needsMe = (n: BoardNotice) => n.requiresAck && !acks[n.id];
  const unreadCount = feed.filter((x) => isUnread(x.n)).length;
  const responseCount = feed.filter((x) => needsMe(x.n)).length;

  const shown = feed.filter(({ n }) => (chip === "all" ? true : chip === "unread" ? isUnread(n) : chip === "response" ? needsMe(n) : n.category === chip));
  const waiting = chip === "all" ? shown.filter((x) => needsMe(x.n)) : [];
  const rest = chip === "all" ? shown.filter((x) => !needsMe(x.n)) : shown;

  const markRead = (id: string) => {
    if (!getState().noticesRead[id]) setState({ noticesRead: { ...getState().noticesRead, [id]: new Date().toISOString() } });
  };
  const ack = (n: BoardNotice) => {
    const at = new Date().toISOString();
    setState({ acks: { ...getState().acks, [n.id]: at }, noticesRead: { ...getState().noticesRead, [n.id]: getState().noticesRead[n.id] ?? at } });
    toast({ title: isConsent(n) ? "Consent recorded" : "Acknowledged", body: isConsent(n) ? "The class teacher has been told. You can withdraw it by calling the office." : "Thank you. The school can see you've read this." });
  };
  const markAll = () => {
    const at = new Date().toISOString();
    setState({ noticesRead: { ...getState().noticesRead, ...Object.fromEntries(feed.filter((x) => isUnread(x.n)).map((x) => [x.n.id, at])) } });
  };

  const forLabel = (kids: Student[]) => (kids.length === children.length && children.length > 1 ? "All your children" : kids.map((k) => `${k.firstName} · ${classLabel(k.grade, k.section)}`).join(", "));
  const open = feed.find((x) => x.n.id === openId) ?? null;

  const chips: { value: Chip; label: string; count?: number }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: "Unread", count: unreadCount },
    { value: "response", label: "Needs response", count: responseCount },
    ...CATEGORIES.filter((c) => feed.some((x) => x.n.category === c)).map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="mx-auto max-w-[760px]">
      <PageHeader
        title="Notices"
        description={`From the school and ${children.map((c) => `${c.firstName}'s`).join(" and ")} teachers.`}
        actions={
          unreadCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={markAll}>
              <CheckCheck /> Mark all read
            </Button>
          ) : undefined
        }
        className="mb-4"
      />

      <div role="radiogroup" aria-label="Filter notices" className="scroll-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {chips.map((c) => {
          const active = chip === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChip(c.value)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                active ? "border-ink bg-ink text-white" : "border-line-strong/80 bg-surface text-ink-2 hover:border-line-strong",
              )}
            >
              {c.label}
              {c.count !== undefined && c.count > 0 && <span className={cn("tnum rounded-full px-1.5 text-[11px] leading-[18px]", active ? "bg-white/20 text-white" : "bg-brand-soft text-brand")}>{c.count}</span>}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-surface">
          {chip === "unread" ? (
            <EmptyState icon={<CheckCircle2 />} title="You're all caught up" body="New notices from the school will show here, and on your phone as a notification." />
          ) : chip === "response" ? (
            <EmptyState icon={<CheckCircle2 />} title="Nothing needs your reply" body="When the school asks for consent or an acknowledgement, it will wait for you here." />
          ) : (
            <EmptyState
              icon={<BellOff />}
              title={`No ${chip === "all" ? "" : chip.toLowerCase() + " "}notices yet`}
              body="Notices for your children's classes and bus route appear here."
              action={
                chip !== "all" ? (
                  <Button size="sm" onClick={() => setChip("all")}>
                    Show all notices
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {waiting.length > 0 && (
            <section aria-label="Waiting for your reply">
              <h2 className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
                Waiting for your reply <Badge tone="warn">{waiting.length}</Badge>
              </h2>
              <div className="flex flex-col gap-3">
                {waiting.map(({ n, kids }) => (
                  <FeedCard
                    key={n.id}
                    n={n}
                    now={now}
                    unread={isUnread(n)}
                    ackAt={acks[n.id]}
                    forLabel={forLabel(kids)}
                    onOpen={() => {
                      setOpenId(n.id);
                      markRead(n.id);
                    }}
                    onAck={() => ack(n)}
                  />
                ))}
              </div>
            </section>
          )}
          {rest.length > 0 && (
            <section aria-label="Notices">
              {waiting.length > 0 && <h2 className="mb-2.5 text-[13px] font-semibold text-ink">Latest</h2>}
              <div className="flex flex-col gap-3">
                {rest.map(({ n, kids }) => (
                  <FeedCard
                    key={n.id}
                    n={n}
                    now={now}
                    unread={isUnread(n)}
                    ackAt={acks[n.id]}
                    forLabel={forLabel(kids)}
                    onOpen={() => {
                      setOpenId(n.id);
                      markRead(n.id);
                    }}
                    onAck={() => ack(n)}
                  />
                ))}
              </div>
            </section>
          )}
          <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[12px] text-faint">
            <Inbox className="size-3.5" /> Notices from the last term are in the school office archive.
          </p>
        </div>
      )}

      <Dialog open={Boolean(open)} onClose={() => setOpenId(null)} side title={open ? open.n.category : ""} description={open ? forLabel(open.kids) : undefined}>
        {open && (
          <article>
            <Badge tone={categoryTone(open.n.category)}>{open.n.category}</Badge>
            <h3 className="mt-3 text-[19px] leading-snug font-semibold text-ink">{open.n.title}</h3>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {open.n.author} · {fmtWeekdayLong(open.n.postedAt)}, {fmtTime(open.n.postedAt)}
            </p>
            <p className="mt-4 text-[14.5px] leading-[1.7] whitespace-pre-line text-ink-2">{open.n.body}</p>
            {open.n.requiresAck && (
              <div className="mt-6 rounded-xl border border-line bg-surface-2 p-4">
                {acks[open.n.id] ? (
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-good">
                    <CheckCircle2 className="size-4" /> {ackLabel(open.n, acks[open.n.id])}
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] text-ink-2">{isConsent(open.n) ? `By giving consent you allow ${open.kids.map((k) => k.firstName).join(" and ")} to take part.` : "Let the school know you've read this notice."}</p>
                    <Button variant="primary" size="lg" className="mt-3 w-full" onClick={() => ack(open.n)}>
                      {isConsent(open.n) ? "Give consent" : "Acknowledge"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </article>
        )}
      </Dialog>
    </div>
  );
}
