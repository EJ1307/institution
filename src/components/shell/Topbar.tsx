"use client";

import { Bell, Check, ChevronDown, LogOut, Menu as MenuIcon, RotateCcw, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { classLabel } from "@/lib/data/school";
import { notificationsFor } from "@/lib/notifications";
import { PERSONAS, signIn, signOut, useChild, useRole, useSession } from "@/lib/session";
import { getState, resetDemo, setState, useAppState, type Role } from "@/lib/store";
import { Avatar, Button, cn, Kbd } from "@/components/ui/primitives";
import { Menu, MenuItem, MenuLabel, MenuSeparator, useToast } from "@/components/ui/overlay";

const ROLE_LABEL: Record<Role, string> = { admin: "Principal", teacher: "Teacher", parent: "Parent" };

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const role = useRole();
  const session = useSession();
  const router = useRouter();
  const toast = useToast();

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex h-[60px] max-w-[1360px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <MenuIcon />
        </Button>

        <button
          type="button"
          onClick={onSearch}
          className="hidden h-9 w-full max-w-[340px] items-center gap-2.5 rounded-lg border border-line-strong/80 bg-surface px-3 text-[13px] text-faint shadow-[0_1px_1px_rgb(0_0_0/0.02)] transition-colors hover:border-line-strong hover:text-muted sm:flex"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">{role === "parent" ? "Search" : "Search students, staff, pages"}</span>
          <Kbd>⌘K</Kbd>
        </button>
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={onSearch} aria-label="Search">
          <Search />
        </Button>

        <div className="flex-1" />

        {role === "parent" && <ChildSwitcher />}

        <Menu
          width={260}
          label="Demo role"
          trigger={({ toggle, ref, open }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="hidden h-8 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-[12px] text-muted transition-colors hover:border-brand hover:text-brand md:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-accent" />
              Demo · viewing as <span className="font-semibold text-ink-2">{ROLE_LABEL[role]}</span>
              <ChevronDown className="size-3.5" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuLabel>Switch demo role</MenuLabel>
              {(Object.keys(PERSONAS) as Role[]).map((r) => (
                <MenuItem
                  key={r}
                  icon={r === role ? <Check className="text-brand" /> : <span className="block size-4" />}
                  hint={ROLE_LABEL[r]}
                  onClick={() => {
                    close();
                    signIn(r);
                    router.push("/dashboard");
                  }}
                >
                  {PERSONAS[r].name}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem
                icon={<RotateCcw />}
                onClick={() => {
                  close();
                  resetDemo();
                  toast({ title: "Demo data reset", body: "Attendance, payments and notices are back to the starting state.", tone: "info" });
                }}
              >
                Reset demo data
              </MenuItem>
            </>
          )}
        </Menu>

        <Notifications />

        <Menu
          width={250}
          label="Account"
          trigger={({ toggle, ref, open }) => (
            <button ref={ref} type="button" onClick={toggle} aria-expanded={open} aria-label="Account menu" className="flex items-center gap-2 rounded-full p-0.5 pr-1 transition-colors hover:bg-ink/5 sm:pr-2">
              <Avatar name={session?.name ?? "User"} size={32} />
              <span className="hidden text-left leading-tight xl:block">
                <span className="block text-[12.5px] font-medium text-ink">{session?.name}</span>
                <span className="block text-[11px] text-muted">{ROLE_LABEL[role]}</span>
              </span>
              <ChevronDown className="hidden size-3.5 text-muted sm:block" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2.5 py-2">
                <p className="text-[13px] font-medium text-ink">{session?.name}</p>
                <p className="text-[11.5px] leading-snug text-muted">{PERSONAS[role].title}</p>
              </div>
              <MenuSeparator />
              <div className="md:hidden">
                <MenuLabel>Demo role</MenuLabel>
                {(Object.keys(PERSONAS) as Role[]).map((r) => (
                  <MenuItem
                    key={r}
                    icon={r === role ? <Check className="text-brand" /> : <span className="block size-4" />}
                    onClick={() => {
                      close();
                      signIn(r);
                      router.push("/dashboard");
                    }}
                  >
                    {ROLE_LABEL[r]}
                  </MenuItem>
                ))}
                <MenuSeparator />
              </div>
              <MenuItem icon={<UserRound />} onClick={close}>
                My profile
              </MenuItem>
              <MenuItem
                icon={<LogOut />}
                onClick={() => {
                  close();
                  signOut();
                  router.push("/login");
                }}
              >
                Sign out
              </MenuItem>
            </>
          )}
        </Menu>
      </div>
    </header>
  );
}

function ChildSwitcher() {
  const { child, children, setChild } = useChild();
  return (
    <Menu
      width={240}
      label="Switch child"
      trigger={({ toggle, ref, open }) => (
        <button ref={ref} type="button" onClick={toggle} aria-expanded={open} className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface py-1 pr-2.5 pl-1 text-[12.5px] shadow-[0_1px_1px_rgb(0_0_0/0.03)] hover:border-line-strong">
          <Avatar name={child.name} size={26} />
          <span className="font-medium text-ink">{child.firstName}</span>
          <span className="text-muted">{classLabel(child.grade, child.section)}</span>
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Your children</MenuLabel>
          {children.map((c) => (
            <button
              key={c.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setChild(c.id);
                close();
              }}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink/[0.045]", c.id === child.id && "bg-brand-soft/60")}
            >
              <Avatar name={c.name} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-ink">{c.name}</span>
                <span className="block text-[11.5px] text-muted">Class {classLabel(c.grade, c.section)} · Roll {c.roll}</span>
              </span>
              {c.id === child.id && <Check className="size-4 text-brand" />}
            </button>
          ))}
        </>
      )}
    </Menu>
  );
}

function Notifications() {
  const role = useRole();
  const state = useAppState((s) => s);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  const items = useMemo(() => notificationsFor(role, state), [role, state, tick]);
  const unread = items.filter((n) => !state.readNotifications[n.id]).length;
  const markAll = () =>
    setState({ readNotifications: { ...getState().readNotifications, ...Object.fromEntries(items.map((n) => [n.id, true as const])) } });

  return (
    <Menu
      width={360}
      label="Notifications"
      trigger={({ toggle, ref, open }) => (
        <button ref={ref} type="button" onClick={toggle} aria-expanded={open} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid size-9 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink">
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] leading-4 font-semibold text-white ring-2 ring-paper">{unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
            <span className="text-[13px] font-semibold">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-[12px] font-medium text-brand hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="scroll-thin max-h-[380px] overflow-y-auto">
            {items.length === 0 && <p className="px-3 py-8 text-center text-[13px] text-muted">You're all caught up.</p>}
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => {
                  setState({ readNotifications: { ...getState().readNotifications, [n.id]: true } });
                  close();
                }}
                className="flex gap-3 rounded-lg px-2.5 py-2.5 hover:bg-ink/[0.04]"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", state.readNotifications[n.id] ? "bg-transparent" : { bad: "bg-bad", warn: "bg-[#D9961F]", info: "bg-info", good: "bg-good" }[n.tone])} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("text-[13px] text-ink", !state.readNotifications[n.id] && "font-medium")}>{n.title}</span>
                    <span className="shrink-0 text-[11px] text-faint">{n.time}</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted">{n.body}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Menu>
  );
}
