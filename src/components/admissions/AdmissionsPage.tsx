"use client";

import { ChevronLeft, ChevronRight, Columns3, List, MoreHorizontal, Plus, RotateCcw, SearchX, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Legend, SERIES } from "@/components/charts/misc";
import { Checkbox, SearchInput, Segmented, Select } from "@/components/ui/forms";
import { EmptyState, PageHeader, Stat } from "@/components/ui/layout";
import { Menu, MenuItem, MenuLabel, MenuSeparator, useToast } from "@/components/ui/overlay";
import { Badge, Button, Card, CardBody, CardHeader, cn } from "@/components/ui/primitives";
import { Pagination, SortTh, Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { ADMISSION_STAGES, applications, SEATS, SOURCES, type AdmissionStage, type Application } from "@/lib/data/admissions";
import { academicYear, today } from "@/lib/data/calendar";
import { GRADE_BY_ID, GRADES, type GradeId } from "@/lib/data/school";
import { fmtDay, number, percent, plural, relativeDays } from "@/lib/format";
import { setState, useAppState } from "@/lib/store";
import { ApplicationSheet } from "./ApplicationSheet";
import { daysSince, nextStage, prevStage, STAGE_TONE } from "./model";
import { NewEnquiryDialog, type EnquiryInput } from "./NewEnquiryDialog";

type View = "board" | "list";
type SortKey = "child" | "grade" | "stage" | "activity" | "source";

const MOVE_NOTE: Record<AdmissionStage, (a: Application) => string> = {
  Enquiry: (a) => `${a.counsellor} will call ${a.parent.split(" ")[0]} to restart the conversation.`,
  "Campus visit": (a) => `A visit confirmation with the school's location goes to ${a.parent.split(" ")[0]} on WhatsApp.`,
  Interaction: () => "A slot request has gone to the coordinator's calendar.",
  "Offer made": () => "The offer letter has been emailed; the seat is held for 7 days.",
  Enrolled: (a) => `Welcome kit and uniform list are on their way to ${a.parent.split(" ")[0]}.`,
  Withdrawn: () => "Removed from the active pipeline. Reopen it any time from “Show withdrawn”.",
};

const SOURCE_SHORT: Record<string, string> = { "Parent referral": "Referral", "School fair": "Fair", Newspaper: "Paper ad" };

function gradeShort(g: GradeId) {
  return g === "N" ? "Nursery" : GRADE_BY_ID[g].short === GRADE_BY_ID[g].label ? GRADE_BY_ID[g].label : `Class ${GRADE_BY_ID[g].short}`;
}

export function AdmissionsPage() {
  const toast = useToast();
  const params = useSearchParams();
  const stages = useAppState((s) => s.admissionStages);
  const added = useAppState((s) => s.newEnquiries);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const apps = useMemo(() => applications(), [stages, added]);
  const ay = academicYear();
  const t = today();

  const [view, setView] = useState<View>(params.get("view") === "list" ? "list" : "board");
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<GradeId | "all">("all");
  const [source, setSource] = useState("all");
  const [counsellor, setCounsellor] = useState("all");
  const [withdrawn, setWithdrawn] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "activity", dir: "desc" });
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(params.get("new") === "1");
  const openId = params.get("app");
  const open = openId ? (apps.find((a) => a.id === openId) ?? null) : null;

  const setOpen = (id: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("app", id);
    else sp.delete("app");
    sp.delete("new");
    const s = sp.toString();
    window.history.replaceState(null, "", s ? `/admissions?${s}` : "/admissions");
  };

  const counsellors = useMemo(() => [...new Set(apps.map((a) => a.counsellor))].sort(), [apps]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return apps.filter((a) => {
      if (!withdrawn && a.stage === "Withdrawn") return false;
      if (grade !== "all" && a.grade !== grade) return false;
      if (source !== "all" && a.source !== source) return false;
      if (counsellor !== "all" && a.counsellor !== counsellor) return false;
      if (!needle) return true;
      return a.child.toLowerCase().includes(needle) || a.parent.toLowerCase().includes(needle) || a.id.toLowerCase().includes(needle) || (digits.length >= 4 && a.phone.replace(/\D/g, "").includes(digits));
    });
  }, [apps, q, grade, source, counsellor, withdrawn]);

  useEffect(() => setPage(0), [q, grade, source, counsellor, withdrawn, sort, view]);

  // KPIs over the active pipeline
  const kpi = useMemo(() => {
    const active = apps.filter((a) => a.stage !== "Withdrawn");
    const reached = (s: AdmissionStage) => active.filter((a) => (ADMISSION_STAGES as readonly string[]).indexOf(a.stage) >= (ADMISSION_STAGES as readonly string[]).indexOf(s)).length;
    const seats = Object.values(SEATS).reduce((x, y) => x + (y ?? 0), 0);
    const enrolled = active.filter((a) => a.stage === "Enrolled").length;
    const offers = active.filter((a) => a.stage === "Offer made").length;
    const thisWeek = apps.filter((a) => daysSince(a.createdOn, t) < 7).length;
    return { active: active.length, visits: reached("Campus visit"), offersReached: reached("Offer made"), offers, enrolled, seats, thisWeek, withdrawn: apps.length - active.length };
  }, [apps, t]);

  const filledByGrade = useMemo(() => {
    const out: Partial<Record<GradeId, number>> = {};
    for (const a of apps) if (a.stage === "Enrolled") out[a.grade] = (out[a.grade] ?? 0) + 1;
    return out;
  }, [apps]);

  const move = (a: Application, to: AdmissionStage) => {
    if (a.stage === to) return;
    setState((st) => ({ admissionStages: { ...st.admissionStages, [a.id]: to } }));
    let body = MOVE_NOTE[to](a);
    if (to === "Enrolled") {
      const filled = (filledByGrade[a.grade] ?? 0) + 1;
      const seats = SEATS[a.grade] ?? 0;
      body = `${gradeShort(a.grade)} now has ${filled} of ${seats} seats filled. ${body}`;
    }
    toast({ title: to === "Withdrawn" ? `${a.child} marked as withdrawn` : `${a.child} moved to ${to.toLowerCase()}`, body, tone: to === "Withdrawn" ? "info" : "good" });
  };

  const create = (e: EnquiryInput) => {
    const n = added.length;
    const id = `ENQ-${ay.nextLabel.slice(2, 4)}${ay.nextLabel.slice(5)}-${1237 + n}`;
    setState((st) => ({
      newEnquiries: [
        ...st.newEnquiries,
        { id, child: e.child, gender: e.gender, dob: e.dob, grade: e.grade, parent: e.parent, phone: e.phone, email: e.email, locality: e.locality, source: e.source, sibling: e.sibling, createdOn: new Date().toISOString() },
      ],
      admissionNotes: e.note.trim() ? { ...st.admissionNotes, [id]: [{ text: e.note.trim(), at: new Date().toISOString(), by: st.session?.name ?? "Admissions office" }] } : st.admissionNotes,
    }));
    setCreating(false);
    toast({ title: `Enquiry ${id} added`, body: `${e.child} for ${gradeShort(e.grade)}. A counsellor will call ${e.parent.split(" ")[0]} within one working day.` });
    setOpen(id);
  };

  const filtersOn = q || grade !== "all" || source !== "all" || counsellor !== "all";
  const reset = () => {
    setQ("");
    setGrade("all");
    setSource("all");
    setCounsellor("all");
  };

  return (
    <>
      <PageHeader
        title={`Admissions ${ay.nextLabel}`}
        description={`Nursery to Class XI for the next academic year · ${number(kpi.seats)} seats across ${Object.keys(SEATS).length} classes · registration closes 31 January`}
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={setView}
              options={[
                { value: "board", label: <><Columns3 className="size-3.5" /> Board</> },
                { value: "list", label: <><List className="size-3.5" /> List</> },
              ]}
            />
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus /> New enquiry
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Active enquiries" value={number(kpi.active)} sub={`+${kpi.thisWeek} this week · ${kpi.withdrawn} withdrawn`} />
        <Stat label="Visited the campus" value={number(kpi.visits)} sub={`${percent(kpi.visits / (kpi.active || 1), 0)} of enquiries`} />
        <Stat label="Offers made" value={number(kpi.offersReached)} sub={`${kpi.offers} awaiting fee payment`} />
        <Stat
          label="Seats filled"
          value={
            <span>
              {kpi.enrolled}
              <span className="text-[16px] font-medium text-muted">/{kpi.seats}</span>
            </span>
          }
          sub={`${percent(kpi.enrolled / (kpi.active || 1), 1)} of enquiries enrolled so far`}
        />
      </div>

      <Card className="mb-4">
        <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search child, parent, phone or ID" className="w-full lg:max-w-[300px] lg:flex-1" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Select aria-label="Class" value={grade} onChange={(e) => setGrade(e.target.value as GradeId | "all")}>
              <option value="all">All classes</option>
              {GRADES.filter((g) => SEATS[g.id]).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="all">All sources</option>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select aria-label="Counsellor" value={counsellor} onChange={(e) => setCounsellor(e.target.value)} className="col-span-2 sm:col-span-1">
              <option value="all">All counsellors</option>
              {counsellors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Checkbox checked={withdrawn} onChange={setWithdrawn} label={`Show withdrawn (${kpi.withdrawn})`} className="col-span-2 sm:col-span-1 sm:ml-1" />
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={reset} className="text-muted">
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="mb-4">
          <EmptyState icon={<SearchX />} title="No applications match" body="Try another class or source, or search by the parent's phone number." action={<Button size="sm" onClick={reset}>Clear filters</Button>} />
        </Card>
      ) : view === "board" ? (
        <Board apps={filtered} withdrawn={withdrawn} onOpen={(a) => setOpen(a.id)} onMove={move} />
      ) : (
        <ListView apps={filtered} sort={sort} setSort={setSort} page={page} setPage={setPage} onOpen={(a) => setOpen(a.id)} />
      )}

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <SeatsCard apps={apps} />
        <div className="flex flex-col gap-4">
          <SourcesCard apps={apps} />
          <FollowUps apps={apps} onOpen={(a) => setOpen(a.id)} />
        </div>
      </div>

      <ApplicationSheet app={open} onClose={() => setOpen(null)} onMove={move} />
      <NewEnquiryDialog
        open={creating}
        onClose={() => {
          setCreating(false);
          if (params.get("new")) setOpen(null);
        }}
        onCreate={create}
        filled={filledByGrade}
      />
    </>
  );
}

// ——— Board ————————————————————————————————————————————————————————

function Board({ apps, withdrawn, onOpen, onMove }: { apps: Application[]; withdrawn: boolean; onOpen: (a: Application) => void; onMove: (a: Application, to: AdmissionStage) => void }) {
  const cols: AdmissionStage[] = [...ADMISSION_STAGES, ...(withdrawn ? (["Withdrawn"] as const) : [])];
  const [over, setOver] = useState<AdmissionStage | null>(null);
  const byId = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);

  const onDrop = (e: DragEvent, stage: AdmissionStage) => {
    e.preventDefault();
    setOver(null);
    const a = byId.get(e.dataTransfer.getData("text/plain"));
    if (a) onMove(a, stage);
  };

  return (
    <div className="scroll-thin -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="grid auto-cols-[minmax(208px,1fr)] grid-flow-col gap-3">
        {cols.map((stage) => {
          const list = apps.filter((a) => a.stage === stage);
          return (
            <section
              key={stage}
              aria-label={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => onDrop(e, stage)}
              className={cn("flex min-w-0 flex-col rounded-[var(--radius-card)] border border-line bg-ink/[0.025] transition-[box-shadow,background-color]", over === stage && "bg-brand-soft/50 shadow-[inset_0_0_0_2px_var(--brand)]")}
            >
              <header className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
                <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
                  <span className={cn("size-2 rounded-full", { neutral: "bg-faint", info: "bg-info", brand: "bg-brand", warn: "bg-[#D9961F]", good: "bg-good" }[STAGE_TONE[stage]])} />
                  {stage}
                </span>
                <span className="tnum rounded-full bg-surface px-1.5 text-[11.5px] leading-5 font-medium text-muted shadow-[0_0_0_1px_var(--line)]">{list.length}</span>
              </header>
              <div className="scroll-thin flex max-h-[600px] min-h-[120px] flex-col gap-2 overflow-y-auto px-2 pb-2">
                {list.map((a) => (
                  <BoardCard key={a.id} a={a} onOpen={() => onOpen(a)} onMove={(to) => onMove(a, to)} />
                ))}
                {list.length === 0 && <p className="px-2 py-6 text-center text-[12px] text-faint">Nothing at this stage</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BoardCard({ a, onOpen, onMove }: { a: Application; onOpen: () => void; onMove: (to: AdmissionStage) => void }) {
  const t = today();
  const prev = prevStage(a.stage);
  const next = nextStage(a.stage);
  const idle = daysSince(a.lastActivity, t);
  const early = a.stage === "Enquiry" || a.stage === "Campus visit";
  const stale = early && idle >= 7 && idle < 30;
  const cold = early && idle >= 30;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", a.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className="group cursor-pointer rounded-lg border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-card)] transition-colors hover:border-line-strong active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={(e) => (stop(e), onOpen())} className="min-w-0 truncate text-left text-[13px] leading-5 font-medium text-ink hover:underline">
          {a.child}
        </button>
        <span className="shrink-0 rounded-md bg-ink/[0.05] px-1.5 text-[11px] leading-5 font-medium text-ink-2">{gradeShort(a.grade)}</span>
      </div>
      <p className="mt-0.5 truncate text-[12px] text-muted">
        {a.parent}
        <span className="text-faint"> · </span>
        {a.score !== null ? <span className="tnum text-ink-2">Score {a.score}</span> : a.sibling ? <span className="font-medium text-brand">Sibling</span> : a.locality}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-[11.5px] text-muted">
          <span className="truncate">{SOURCE_SHORT[a.source] ?? a.source}</span>
          <span className="text-faint">·</span>
          <span className={cn("tnum shrink-0", stale && "font-medium text-warn")} title={cold ? "No contact for over a month" : undefined}>
            {idle === 0 ? "today" : stale ? `${idle}d idle` : cold ? `${idle}d · cold` : `${idle}d ago`}
          </span>
        </span>
        <span className="-mr-1 flex shrink-0 items-center" onClick={stop}>
          {a.stage === "Withdrawn" ? (
            <button type="button" onClick={() => onMove("Enquiry")} className="grid size-6 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink" aria-label={`Reopen ${a.child}'s enquiry`} title="Reopen">
              <RotateCcw className="size-3.5" />
            </button>
          ) : (
            <>
              {prev && (
                <button type="button" onClick={() => onMove(prev)} className="hidden size-6 place-items-center rounded-md text-muted group-hover:grid hover:bg-ink/5 hover:text-ink focus-visible:grid" aria-label={`Move ${a.child} back to ${prev}`} title={`Back to ${prev}`}>
                  <ChevronLeft className="size-3.5" />
                </button>
              )}
              {next && (
                <button type="button" onClick={() => onMove(next)} className="grid size-6 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink" aria-label={`Move ${a.child} to ${next}`} title={`Move to ${next}`}>
                  <ChevronRight className="size-3.5" />
                </button>
              )}
            </>
          )}
          <StageMenu a={a} onMove={onMove} />
        </span>
      </div>
    </article>
  );
}

function StageMenu({ a, onMove }: { a: Application; onMove: (to: AdmissionStage) => void }) {
  return (
    <Menu
      width={210}
      label={`Move ${a.child}`}
      trigger={({ toggle, ref, open }) => (
        <button ref={ref} type="button" onClick={toggle} aria-expanded={open} aria-label={`More actions for ${a.child}`} className="grid size-6 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink">
          <MoreHorizontal className="size-3.5" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>Move to</MenuLabel>
          {ADMISSION_STAGES.filter((s) => s !== a.stage).map((s) => (
            <MenuItem key={s} onClick={() => (close(), onMove(s))}>
              {s}
            </MenuItem>
          ))}
          {a.stage !== "Withdrawn" && (
            <>
              <MenuSeparator />
              <MenuItem icon={<XCircle />} tone="bad" onClick={() => (close(), onMove("Withdrawn"))}>
                Mark withdrawn
              </MenuItem>
            </>
          )}
        </>
      )}
    </Menu>
  );
}

// ——— List ————————————————————————————————————————————————————————

const PAGE = 20;

function ListView({
  apps,
  sort,
  setSort,
  page,
  setPage,
  onOpen,
}: {
  apps: Application[];
  sort: { key: SortKey; dir: "asc" | "desc" };
  setSort: (s: { key: SortKey; dir: "asc" | "desc" }) => void;
  page: number;
  setPage: (n: number) => void;
  onOpen: (a: Application) => void;
}) {
  const t = today();
  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const stageOrder = (s: AdmissionStage) => (s === "Withdrawn" ? -1 : (ADMISSION_STAGES as readonly string[]).indexOf(s));
    return [...apps].sort((x, y) => {
      switch (sort.key) {
        case "child":
          return dir * x.child.localeCompare(y.child);
        case "grade":
          return dir * (GRADE_BY_ID[x.grade].order - GRADE_BY_ID[y.grade].order);
        case "stage":
          return dir * (stageOrder(x.stage) - stageOrder(y.stage));
        case "source":
          return dir * x.source.localeCompare(y.source);
        default:
          return dir * (x.lastActivity.getTime() - y.lastActivity.getTime());
      }
    });
  }, [apps, sort]);
  const onSort = (k: SortKey) => setSort(sort.key === k ? { key: k, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "activity" ? "desc" : "asc" });
  const rows = sorted.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <Card className="mb-0">
      <Table>
        <THead>
          <tr>
            <SortTh label="Child" k="child" sort={sort} onSort={onSort} />
            <SortTh label="Class" k="grade" sort={sort} onSort={onSort} />
            <Th className="hidden md:table-cell">Parent</Th>
            <SortTh label="Stage" k="stage" sort={sort} onSort={onSort} />
            <SortTh label="Source" k="source" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
            <Th className="hidden xl:table-cell">Next step</Th>
            <SortTh label="Last activity" k="activity" sort={sort} onSort={onSort} align="right" />
          </tr>
        </THead>
        <tbody>
          {rows.map((a) => (
            <Tr key={a.id} onClick={() => onOpen(a)}>
              <Td>
                <button type="button" onClick={(e) => (e.stopPropagation(), onOpen(a))} className="block text-left font-medium text-ink hover:underline">
                  {a.child}
                </button>
                <span className="tnum block text-[12px] text-muted">{a.id}</span>
              </Td>
              <Td className="whitespace-nowrap text-ink-2">{gradeShort(a.grade)}</Td>
              <Td className="hidden md:table-cell">
                <span className="block text-ink-2">{a.parent}</span>
                <span className="tnum block text-[12px] text-muted">{a.phone}</span>
              </Td>
              <Td>
                <Badge tone={STAGE_TONE[a.stage]} dot>
                  {a.stage}
                </Badge>
              </Td>
              <Td className="hidden text-ink-2 lg:table-cell">{a.source}</Td>
              <Td className="hidden max-w-[240px] truncate text-ink-2 xl:table-cell">{a.nextStep}</Td>
              <Td align="right" className="whitespace-nowrap text-ink-2">
                {relativeDays(a.lastActivity, t)}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={page} pageSize={PAGE} total={sorted.length} onPage={setPage} noun="applications" />
    </Card>
  );
}

// ——— Seats & sources ————————————————————————————————————————————————————

function SeatsCard({ apps }: { apps: Application[] }) {
  const rows = GRADES.filter((g) => SEATS[g.id]).map((g) => {
    const list = apps.filter((a) => a.grade === g.id);
    const enrolled = list.filter((a) => a.stage === "Enrolled").length;
    const offers = list.filter((a) => a.stage === "Offer made").length;
    const pipeline = list.filter((a) => a.stage === "Enquiry" || a.stage === "Campus visit" || a.stage === "Interaction").length;
    const seats = SEATS[g.id]!;
    return { g, seats, enrolled, offers, pipeline, left: seats - enrolled };
  });
  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title="Seats by class"
        description="Enrolled and offered against the seats open for next year"
        action={
          <Legend
            className="hidden sm:flex"
            items={[
              { label: "Enrolled", color: SERIES.s1 },
              { label: "Offer made", color: SERIES.s2 },
            ]}
          />
        }
      />
      <Table>
        <THead>
          <tr>
            <Th>Class</Th>
            <Th align="right">Seats</Th>
            <Th className="w-[34%]">Filled</Th>
            <Th align="right">Enrolled</Th>
            <Th align="right" className="hidden sm:table-cell">
              Offers out
            </Th>
            <Th align="right" className="hidden md:table-cell">
              In pipeline
            </Th>
            <Th align="right">Open</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.g.id} className="[&>td]:h-10">
              <Td className="font-medium whitespace-nowrap text-ink">{r.g.label}</Td>
              <Td align="right">{r.seats}</Td>
              <Td>
                <div className="flex h-2 overflow-hidden rounded-full bg-ink/[0.05]" role="img" aria-label={`${r.enrolled} enrolled and ${r.offers} offers out of ${r.seats} seats`}>
                  <div style={{ width: `${Math.min(100, (r.enrolled / r.seats) * 100)}%`, background: SERIES.s1 }} />
                  {r.offers > 0 && r.enrolled < r.seats && <div className="border-l-2 border-surface" style={{ width: `${Math.min(100 - (r.enrolled / r.seats) * 100, (r.offers / r.seats) * 100)}%`, background: SERIES.s2 }} />}
                </div>
              </Td>
              <Td align="right" className="font-medium text-ink">
                {r.enrolled}
              </Td>
              <Td align="right" className="hidden text-ink-2 sm:table-cell">
                {r.offers}
              </Td>
              <Td align="right" className="hidden text-ink-2 md:table-cell">
                {r.pipeline}
              </Td>
              <Td align="right" className={cn("font-medium", r.left <= 0 ? "text-bad" : r.left <= 2 ? "text-warn" : "text-ink")}>
                {r.left <= 0 ? "Full" : r.left}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function SourcesCard({ apps }: { apps: Application[] }) {
  const rows = SOURCES.map((s) => {
    const list = apps.filter((a) => a.source === s);
    const converted = list.filter((a) => a.stage === "Offer made" || a.stage === "Enrolled").length;
    return { s, n: list.length, conv: converted / (list.length || 1), converted };
  }).sort((a, b) => b.n - a.n);
  const best = [...rows].filter((r) => r.n >= 10).sort((a, b) => b.conv - a.conv)[0];
  return (
    <Card>
      <CardHeader title="Where enquiries come from" description={`${number(apps.length)} enquiries since ${fmtDay(apps.reduce((m, a) => (a.createdOn < m ? a.createdOn : m), today()))}`} />
      <CardBody>
        <div className="mb-2 grid grid-cols-[96px_1fr_40px_48px] gap-3 text-[11.5px] font-medium text-muted">
          <span>Source</span>
          <span />
          <span className="text-right">Count</span>
          <span className="text-right">Convert</span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <li key={r.s} className="grid grid-cols-[96px_1fr_40px_48px] items-center gap-3 text-[12.5px]" title={`${r.s}: ${r.n} enquiries, ${r.converted} offers or enrolments`}>
              <span className="truncate text-ink-2">{r.s}</span>
              <span className="relative h-2">
                <span className="absolute inset-0 rounded-full bg-ink/[0.045]" />
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.n / (rows[0].n || 1)) * 100}%`, background: SERIES.s1 }} />
              </span>
              <span className="tnum text-right font-semibold text-ink">{r.n}</span>
              <span className={cn("tnum text-right", r === best ? "font-semibold text-good" : "text-ink-2")}>{percent(r.conv, 0)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-line pt-3 text-[12px] text-muted">Convert = share of enquiries that reached an offer or enrolled.</p>
        {best && (
          <p className="mt-2 text-[12px] text-ink-2">
            {best.s} enquiries convert best ({percent(best.conv, 0)}).{best.s === "Parent referral" ? " Worth a referral drive before the Nursery deadline." : " Worth more of the budget before the Nursery deadline."}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function FollowUps({ apps, onOpen }: { apps: Application[]; onOpen: (a: Application) => void }) {
  const t = today();
  const stale = apps
    .filter((a) => (a.stage === "Enquiry" || a.stage === "Campus visit") && daysSince(a.lastActivity, t) >= 7 && daysSince(a.lastActivity, t) < 30)
    .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime());
  return (
    <Card>
      <CardHeader title="Follow-ups overdue" description={stale.length ? `${plural(stale.length, "family", "families")} without contact for 1–4 weeks` : "Every family has heard from us this week"} />
      {stale.length > 0 && (
        <ul className="px-5 pb-3">
          {stale.slice(0, 5).map((a) => (
            <li key={a.id} className="border-t border-line first:border-t-0">
              <button type="button" onClick={() => onOpen(a)} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{a.child}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {gradeShort(a.grade)} · {a.stage} · {a.counsellor}
                  </span>
                </span>
                <span className="tnum shrink-0 text-[12px] font-medium text-warn">{daysSince(a.lastActivity, t)} days</span>
              </button>
            </li>
          ))}
          {stale.length > 5 && <li className="border-t border-line pt-2.5 text-[12px] text-muted">and {stale.length - 5} more on the board, marked “idle”</li>}
        </ul>
      )}
    </Card>
  );
}
