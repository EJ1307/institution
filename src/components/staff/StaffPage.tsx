"use client";

import { ChevronRight, Download, SearchX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { SearchInput, Segmented, Select, Tabs } from "@/components/ui/forms";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Badge, Button, Card } from "@/components/ui/primitives";
import { Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { downloadCsv, SummaryCell, SummaryStrip } from "@/components/students/shared";
import { currentSchoolDay, leaveRequests } from "@/lib/data/attendance";
import { isoDate } from "@/lib/data/calendar";
import { staff, staffById, students, type Staff, type StaffCategory } from "@/lib/data/people";
import { SUBJECTS } from "@/lib/data/school";
import { fmtWeekday, number, plural } from "@/lib/format";
import { useBrand } from "@/lib/session";
import { useAppState } from "@/lib/store";
import { LeaveRequests } from "./LeaveRequests";
import { classesTaught, presenceOn, shortClass, weeklyLoad } from "./staffData";
import { PresenceBadge, StaffSheet } from "./StaffSheet";

const DEPT_ORDER = [
  "Leadership", "Pre-primary", "Primary", "Mathematics", "Science", "Languages", "Humanities", "Commerce", "Computer Science",
  "Sports", "Arts", "Library", "Student support", "Accounts", "Admissions", "Administration", "IT", "Transport",
];

const CATS: { value: StaffCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Teaching", label: "Teaching" },
  { value: "Leadership", label: "Leadership" },
  { value: "Co-curricular", label: "Co-curricular" },
  { value: "Student support", label: "Support" },
  { value: "Administration", label: "Admin" },
];

type Tab = "directory" | "leave";

export function StaffPage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const brand = useBrand();
  const decisions = useAppState((s) => s.leaveDecisions);
  const day = currentSchoolDay();

  const tab: Tab = params.get("tab") === "leave" ? "leave" : "directory";
  const openId = params.get("id");
  const person = openId ? (staffById(openId) ?? null) : null;

  const nav = (next: { tab?: Tab; id?: string | null }) => {
    const q = new URLSearchParams(params.toString());
    if (next.tab !== undefined) {
      if (next.tab === "directory") q.delete("tab");
      else q.set("tab", next.tab);
    }
    if (next.id !== undefined) {
      if (next.id) q.set("id", next.id);
      else q.delete("id");
    }
    const s = q.toString();
    router.replace(s ? `/staff?${s}` : "/staff", { scroll: false });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const presence = useMemo(() => presenceOn(day), [decisions, day.getTime()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pending = useMemo(() => leaveRequests().filter((l) => l.status === "pending").length, [decisions]);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<StaffCategory | "all">("all");
  const [dept, setDept] = useState("all");
  const [today, setToday] = useState<"all" | "in" | "late" | "leave">("all");

  const all = staff();
  const teaching = all.filter((s) => s.category === "Teaching");
  const meta = useMemo(() => new Map(all.map((s) => [s.id, { classes: classesTaught(s.id), load: weeklyLoad(s.id) }])), [all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((s) => {
      if (cat !== "all" && s.category !== cat) return false;
      if (dept !== "all" && s.department !== dept) return false;
      const p = presence.get(s.id)!;
      if (today === "in" && p.status === "leave") return false;
      if (today === "late" && p.status !== "late") return false;
      if (today === "leave" && p.status !== "leave") return false;
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.designation.toLowerCase().includes(needle) ||
        s.subjects.some((x) => SUBJECTS[x]?.name.toLowerCase().includes(needle)) ||
        (s.classTeacherOf && shortClass(s.classTeacherOf).toLowerCase() === needle)
      );
    });
  }, [all, q, cat, dept, today, presence]);

  const groups = useMemo(() => {
    const by = new Map<string, Staff[]>();
    for (const s of filtered) by.set(s.department, [...(by.get(s.department) ?? []), s]);
    return [...by.entries()].sort((a, b) => DEPT_ORDER.indexOf(a[0]) - DEPT_ORDER.indexOf(b[0]));
  }, [filtered]);

  const counts = {
    present: [...presence.values()].filter((p) => p.status !== "leave").length,
    late: [...presence.values()].filter((p) => p.status === "late").length,
    leave: [...presence.values()].filter((p) => p.status === "leave"),
  };
  const ratio = Math.round(students().length / teaching.length);
  const avgExp = all.reduce((a, s) => a + s.experience, 0) / all.length;
  const departments = DEPT_ORDER.filter((d) => all.some((s) => s.department === d));
  const filtersOn = q || cat !== "all" || dept !== "all" || today !== "all";

  const exportCsv = () => {
    downloadCsv(
      `${brand.short.toLowerCase()}-staff-${isoDate(new Date())}.csv`,
      ["Name", "Designation", "Department", "Category", "Subjects", "Class teacher of", "Qualification", "Joined", "Experience (years)", "Mobile", "Email", `Status ${isoDate(day)}`],
      filtered.map((s) => {
        const p = presence.get(s.id)!;
        return [
          `${s.title} ${s.name}`, s.designation, s.department, s.category, s.subjects.map((x) => SUBJECTS[x]?.name ?? x).join("; "),
          s.classTeacherOf ? shortClass(s.classTeacherOf) : "", s.qualification, s.joinedYear, s.experience, s.phone, s.email,
          p.status === "leave" ? `On leave (${p.leave?.type})` : p.status === "late" ? `Late, in at ${p.time}` : `In at ${p.time}`,
        ];
      }),
    );
    toast({ title: `Exported ${plural(filtered.length, "staff record")}`, body: filtersOn ? "Only the people matching your filters were included." : "Everyone on the payroll, grouped as on screen." });
  };

  return (
    <>
      <PageHeader
        title="Staff"
        description={`${all.length} people · ${teaching.length} teaching, ${all.length - teaching.length} in leadership, support and administration`}
        actions={
          tab === "directory" ? (
            <Button variant="secondary" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onChange={(t) => nav({ tab: t })}
        tabs={[
          { value: "directory", label: "Directory", count: all.length },
          { value: "leave", label: "Leave requests", count: pending },
        ]}
        className="mb-5"
      />

      {tab === "leave" ? (
        <LeaveRequests onOpen={(id) => nav({ id })} />
      ) : (
        <>
          <SummaryStrip className="mb-4 grid-cols-2 md:grid-cols-5">
            <SummaryCell
              className="col-span-2 md:col-span-1"
              label={`In school · ${fmtWeekday(day)}`}
              value={
                <span>
                  {counts.present}
                  <span className="text-[14px] font-medium text-muted">/{all.length}</span>
                </span>
              }
              sub={`Biometric check-in from 7:10 am`}
            />
            <SummaryCell label="Arrived late" value={counts.late} sub="after 8:00 am" />
            <SummaryCell
              label="On leave today"
              value={counts.leave.length}
              sub={<span className="block truncate">{counts.leave.map((l) => `${l.leave!.staff.title} ${l.leave!.staff.lastName}`).join(", ") || "Everyone is in"}</span>}
            />
            <SummaryCell label="Student–teacher ratio" value={`1 : ${ratio}`} sub={`${teaching.length} teachers · ${number(students().length)} students`} />
            <SummaryCell label="Average experience" value={`${avgExp.toFixed(1)} yrs`} sub={`${all.filter((s) => /M\.(A|Sc|Ed|Com)|Ph\.D|MBA|MCA|M\.Lib/.test(s.qualification)).length} hold a postgraduate degree`} />
          </SummaryStrip>

          <Card>
            <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:px-5 xl:flex-row xl:items-center">
              <SearchInput value={q} onChange={setQ} placeholder="Search name or subject" className="w-full xl:min-w-[180px] xl:flex-1" />
              <div className="scroll-thin -mx-1 overflow-x-auto px-1">
                <Segmented
                  label="Category"
                  value={cat}
                  onChange={(v) => {
                    setCat(v);
                    setDept("all");
                  }}
                  options={CATS.map((c) => ({ ...c, count: c.value === "all" ? all.length : all.filter((s) => s.category === c.value).length }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="all">All departments</option>
                  {departments
                    .filter((d) => cat === "all" || all.some((s) => s.department === d && s.category === cat))
                    .map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                </Select>
                <Select aria-label="Today" value={today} onChange={(e) => setToday(e.target.value as typeof today)}>
                  <option value="all">Anyone today</option>
                  <option value="in">In school</option>
                  <option value="late">Arrived late</option>
                  <option value="leave">On leave</option>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<SearchX />}
                title="No one matches"
                body="Try a subject (“Physics”), a designation (“PGT”) or clear the filters."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setQ("");
                      setCat("all");
                      setDept("all");
                      setToday("all");
                    }}
                  >
                    Clear filters
                  </Button>
                }
                className="border-t border-line"
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <THead>
                      <tr>
                        <Th>Name</Th>
                        <Th>Teaches</Th>
                        <Th className="hidden lg:table-cell">Class teacher</Th>
                        <Th className="hidden xl:table-cell">Experience</Th>
                        <Th>Today</Th>
                        <Th className="w-8">
                          <span className="sr-only">Open</span>
                        </Th>
                      </tr>
                    </THead>
                    <tbody>
                      {groups.map(([d, people]) => (
                        <Fragment key={d}>
                          <tr className="border-b border-line bg-surface-2/70">
                            <td colSpan={6} className="h-8 px-5 text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">
                              {d} <span className="tnum ml-1 font-medium tracking-normal normal-case text-faint">{people.length}</span>
                            </td>
                          </tr>
                          {people.map((s) => {
                            const m = meta.get(s.id)!;
                            return (
                              <Tr key={s.id} onClick={() => nav({ id: s.id })} className="group">
                                <Td>
                                  <div className="flex items-center gap-3">
                                    <Avatar name={s.name} size={30} />
                                    <div className="min-w-0">
                                      <button type="button" onClick={(e) => (e.stopPropagation(), nav({ id: s.id }))} className="block truncate text-left font-medium text-ink hover:underline">
                                        {s.title} {s.name}
                                      </button>
                                      <span className="block truncate text-[12px] text-muted">{s.designation}</span>
                                    </div>
                                  </div>
                                </Td>
                                <Td className="max-w-[300px]">
                                  {!m.classes.length && s.classTeacherOf && s.subjects.length ? (
                                    <>
                                      <span className="block truncate text-ink-2">{s.subjects.map((x) => SUBJECTS[x]?.name ?? x).join(", ")}</span>
                                      <span className="block truncate text-[12px] text-muted">{shortClass(s.classTeacherOf)} · all day, activity-based</span>
                                    </>
                                  ) : m.classes.length ? (
                                    <>
                                      <span className="block truncate text-ink-2">{s.subjects.map((x) => SUBJECTS[x]?.name ?? x).join(", ")}</span>
                                      <span className="tnum block truncate text-[12px] text-muted">
                                        {m.classes.slice(0, 5).map(shortClass).join(", ")}
                                        {m.classes.length > 5 ? ` +${m.classes.length - 5}` : ""} · {m.load} periods/wk
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-faint">—</span>
                                  )}
                                </Td>
                                <Td className="hidden lg:table-cell">{s.classTeacherOf ? <Badge tone="brand">{shortClass(s.classTeacherOf)}</Badge> : <span className="text-faint">—</span>}</Td>
                                <Td className="tnum hidden text-ink-2 xl:table-cell">
                                  {plural(s.experience, "yr")}
                                  <span className="block text-[12px] text-muted">here since {s.joinedYear}</span>
                                </Td>
                                <Td>
                                  <PresenceBadge p={presence.get(s.id)} />
                                </Td>
                                <Td className="text-faint">
                                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-muted" aria-hidden />
                                </Td>
                              </Tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </Table>
                </div>
                <div className="border-t border-line md:hidden">
                  {groups.map(([d, people]) => (
                    <section key={d}>
                      <h3 className="border-b border-line bg-surface-2/70 px-4 py-1.5 text-[11.5px] font-semibold tracking-[0.04em] text-muted uppercase">
                        {d} <span className="tnum font-medium text-faint">{people.length}</span>
                      </h3>
                      <ul>
                        {people.map((s) => (
                          <li key={s.id} className="border-b border-line">
                            <button type="button" onClick={() => nav({ id: s.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2">
                              <Avatar name={s.name} size={34} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-medium text-ink">
                                  {s.title} {s.name}
                                </span>
                                <span className="block truncate text-[12px] text-muted">
                                  {s.designation}
                                  {s.classTeacherOf ? ` · CT ${shortClass(s.classTeacherOf)}` : ""}
                                </span>
                              </span>
                              <PresenceBadge p={presence.get(s.id)} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
                <div className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
                  Showing {plural(filtered.length, "person", "people")} in {plural(groups.length, "department")}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      <StaffSheet person={person} presence={person ? presence.get(person.id) : undefined} onClose={() => nav({ id: null })} />
    </>
  );
}
