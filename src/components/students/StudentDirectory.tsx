"use client";

import { ChevronRight, Download, SearchX, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SearchInput, Select } from "@/components/ui/forms";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { useToast } from "@/components/ui/overlay";
import { Avatar, Button, Card } from "@/components/ui/primitives";
import { Pagination, SortTh, Table, Td, Th, THead, Tr } from "@/components/ui/table";
import { academicYear, isoDate } from "@/lib/data/calendar";
import { feeAccount, type FeeAccount } from "@/lib/data/fees";
import { students, type Student } from "@/lib/data/people";
import { CLASSES, GRADE_BY_ID, GRADES, HOUSES, classLabel, type GradeId } from "@/lib/data/school";
import { ROUTE_BY_ID } from "@/lib/data/transport";
import { number, percent } from "@/lib/format";
import { useBrand } from "@/lib/session";
import { useAppState } from "@/lib/store";
import { AddStudentDialog } from "./AddStudentDialog";
import { downloadCsv, FEE_STATE_LABEL, FeeBadge, feeState, HouseTag, SummaryCell, SummaryStrip, type FeeState } from "./shared";

type SortKey = "name" | "class" | "admission" | "house" | "fees";
type Row = { s: Student; acc: FeeAccount; fee: FeeState };

const PAGE = 25;

export function StudentDirectory() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const brand = useBrand();
  const payments = useAppState((s) => s.payments);
  const ay = academicYear();

  const initialClass = params.get("class");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [grade, setGrade] = useState<GradeId | "all">(() => (initialClass ? (initialClass.split("-")[0] as GradeId) : "all"));
  const [section, setSection] = useState<string>(() => (initialClass ? (initialClass.split("-")[1] ?? "all") : "all"));
  const [house, setHouse] = useState("all");
  const [transport, setTransport] = useState<"all" | "yes" | "no">("all");
  const [fee, setFee] = useState<FeeState | "all">((params.get("fees") as FeeState) ?? "all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "class", dir: "asc" });
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);

  const all = useMemo<Row[]>(
    () =>
      students().map((s) => {
        const acc = feeAccount(s);
        return { s, acc, fee: feeState(acc) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments],
  );

  const sectionsForGrade = grade === "all" ? ["A", "B", "C", "D"] : GRADE_BY_ID[grade].sections;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const list = all.filter(({ s, fee: f }) => {
      if (grade !== "all" && s.grade !== grade) return false;
      if (section !== "all" && s.section !== section) return false;
      if (house !== "all" && s.house !== house) return false;
      if (transport === "yes" && !s.routeId) return false;
      if (transport === "no" && s.routeId) return false;
      if (fee !== "all" && f !== fee) return false;
      if (!needle) return true;
      if (s.name.toLowerCase().includes(needle)) return true;
      if (s.admissionNo.toLowerCase().includes(needle)) return true;
      if (s.guardians.some((g) => g.name.toLowerCase().includes(needle))) return true;
      if (digits.length >= 4 && s.guardians.some((g) => g.phone.replace(/\D/g, "").includes(digits))) return true;
      return false;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    const classCmp = (a: Student, b: Student) =>
      GRADE_BY_ID[a.grade].order - GRADE_BY_ID[b.grade].order || a.section.localeCompare(b.section) || a.roll - b.roll;
    list.sort((x, y) => {
      const a = x.s;
      const b = y.s;
      switch (sort.key) {
        case "name":
          return dir * a.name.localeCompare(b.name);
        case "admission":
          return dir * (a.joinedYear - b.joinedYear || a.admissionNo.localeCompare(b.admissionNo));
        case "house":
          return dir * a.house.localeCompare(b.house) || classCmp(a, b);
        case "fees":
          return dir * (x.acc.overdue * 10 + x.acc.outstanding - (y.acc.overdue * 10 + y.acc.outstanding)) || classCmp(a, b);
        default:
          return dir * classCmp(a, b);
      }
    });
    return list;
  }, [all, q, grade, section, house, transport, fee, sort]);

  useEffect(() => setPage(0), [q, grade, section, house, transport, fee, sort]);

  const summary = useMemo(() => {
    const list = filtered.map((r) => r.s);
    const n = list.length;
    const girls = list.filter((s) => s.gender === "F").length;
    const fresh = list.filter((s) => s.joinedYear === ay.startYear).length;
    const bus = list.filter((s) => s.routeId).length;
    const conc = list.filter((s) => s.concession);
    const byKind = (label: string) => conc.filter((s) => s.concession!.label === label).length;
    return { n, girls, boys: n - girls, fresh, bus, conc: conc.length, sibling: byKind("Sibling"), merit: byKind("Merit scholarship"), staff: byKind("Staff ward"), rte: byKind("EWS (RTE)") };
  }, [filtered, ay.startYear]);

  const filtersOn = q || grade !== "all" || section !== "all" || house !== "all" || transport !== "all" || fee !== "all";
  const reset = () => {
    setQ("");
    setGrade("all");
    setSection("all");
    setHouse("all");
    setTransport("all");
    setFee("all");
  };

  const onSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "fees" ? "desc" : "asc" }));
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const sectionCount = new Set(filtered.map((r) => r.s.classKey)).size;

  const exportCsv = () => {
    if (!filtered.length) return;
    const header = [
      "Admission no.", "Student", "Gender", "Class", "Section", "Roll", "Date of birth", "House", "Blood group",
      "Primary guardian", "Relation", "Mobile", "Second guardian", "Mobile (2)", "Locality", "Bus route", "Concession", "Fee status", "Outstanding (INR)",
    ];
    const rows = filtered.map(({ s, acc, fee: f }) => [
      s.admissionNo, s.name, s.gender === "F" ? "Female" : "Male", GRADE_BY_ID[s.grade].label, s.section, s.roll, s.dob, s.house, s.bloodGroup,
      s.guardians[0]?.name ?? "", s.guardians[0]?.relation ?? "", s.guardians[0]?.phone ?? "", s.guardians[1]?.name ?? "", s.guardians[1]?.phone ?? "",
      s.locality, s.routeId ? `${s.routeId} · ${ROUTE_BY_ID[s.routeId]?.name ?? ""}` : "Own transport",
      s.concession ? `${s.concession.label} (${s.concession.pct}%)` : "", FEE_STATE_LABEL[f], acc.outstanding,
    ]);
    const scope = grade !== "all" ? `-${GRADE_BY_ID[grade].short}${section !== "all" ? section : ""}` : "";
    downloadCsv(`${brand.short.toLowerCase()}-students${scope}-${isoDate(new Date())}.csv`, header, rows);
    toast({ title: `Exported ${number(filtered.length)} ${filtered.length === 1 ? "student" : "students"}`, body: filtersOn ? "Only the rows matching your filters were included." : "The full roll, sorted as on screen." });
  };

  return (
    <>
      <PageHeader
        title="Students"
        description={`${number(all.length)} students on roll across ${CLASSES.length} sections, Nursery to Class XII · AY ${ay.label}`}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
              <Download /> Export CSV
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <UserPlus /> Add student
            </Button>
          </>
        }
      />

      <SummaryStrip className="mb-4 grid-cols-2 md:grid-cols-5">
        <SummaryCell
          className="col-span-2 md:col-span-1"
          label={filtersOn ? "Matching students" : "Students on roll"}
          value={number(summary.n)}
          sub={filtersOn ? `of ${number(all.length)} · ${sectionCount} ${sectionCount === 1 ? "section" : "sections"}` : `${CLASSES.length} sections · ${GRADES.length} grades`}
        />
        <SummaryCell
          label="Boys · Girls"
          value={
            <span>
              {number(summary.boys)} <span className="text-faint">·</span> {number(summary.girls)}
            </span>
          }
          sub={
            <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-ink/[0.05]" aria-label={`${percent(summary.girls / (summary.n || 1), 0)} girls`}>
              <span className="h-full bg-s3" style={{ width: `${(summary.boys / (summary.n || 1)) * 100}%` }} />
              <span className="h-full w-[2px] bg-surface" />
              <span className="h-full flex-1 bg-s2" />
            </span>
          }
        />
        <SummaryCell label={`New admissions ${ay.label}`} value={number(summary.fresh)} sub={`${percent(summary.fresh / (summary.n || 1), 0)} joined this year`} />
        <SummaryCell label="On school transport" value={number(summary.bus)} sub={`${percent(summary.bus / (summary.n || 1), 0)} · ${new Set(filtered.map((r) => r.s.routeId).filter(Boolean)).size} routes`} />
        <SummaryCell
          label="With concession"
          value={number(summary.conc)}
          sub={
            <span className="tnum">
              Sibling {summary.sibling} · Merit {summary.merit} · Staff {summary.staff} · RTE {summary.rte}
            </span>
          }
        />
      </SummaryStrip>

      <Card>
        <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:px-5 xl:flex-row xl:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, admission no., parent or phone" className="w-full xl:max-w-[340px] xl:flex-1" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Select
              aria-label="Class"
              value={grade}
              onChange={(e) => {
                const g = e.target.value as GradeId | "all";
                setGrade(g);
                if (g !== "all" && section !== "all" && !GRADE_BY_ID[g].sections.includes(section)) setSection("all");
              }}
            >
              <option value="all">All classes</option>
              {GRADES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
            <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="all">All sections</option>
              {sectionsForGrade.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </Select>
            <Select aria-label="House" value={house} onChange={(e) => setHouse(e.target.value)}>
              <option value="all">All houses</option>
              {HOUSES.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.id}
                </option>
              ))}
            </Select>
            <Select aria-label="Transport" value={transport} onChange={(e) => setTransport(e.target.value as typeof transport)}>
              <option value="all">Any transport</option>
              <option value="yes">School bus</option>
              <option value="no">Own transport</option>
            </Select>
            <Select aria-label="Fee status" value={fee} onChange={(e) => setFee(e.target.value as typeof fee)} className="col-span-2 sm:col-span-1">
              <option value="all">Any fee status</option>
              <option value="clear">Fees clear</option>
              <option value="due">Fees due</option>
              <option value="overdue">Fees overdue</option>
            </Select>
            {filtersOn && (
              <Button variant="ghost" size="sm" onClick={reset} className="col-span-2 justify-self-start text-muted sm:col-span-1">
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="border-t border-line">
            <EmptyState
              icon={<SearchX />}
              title="No students match"
              body={q ? `Nothing for “${q}” with the current filters. Try a parent's name or the last four digits of a phone number.` : "Try widening the class, house or fee filters."}
              action={
                <Button size="sm" onClick={reset}>
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <tr>
                    <SortTh label="Student" k="name" sort={sort} onSort={onSort} />
                    <SortTh label="Class" k="class" sort={sort} onSort={onSort} />
                    <SortTh label="Admission no." k="admission" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                    <SortTh label="House" k="house" sort={sort} onSort={onSort} />
                    <Th>Parent / guardian</Th>
                    <Th className="hidden xl:table-cell">Transport</Th>
                    <SortTh label="Fees" k="fees" sort={sort} onSort={onSort} />
                    <Th className="w-8">
                      <span className="sr-only">Open</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {pageRows.map(({ s, acc }) => {
                    const g = s.guardians[0];
                    return (
                      <Tr key={s.id} onClick={() => router.push(`/students/${s.id}`)} className="group">
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={s.name} size={30} />
                            <div className="min-w-0">
                              <Link href={`/students/${s.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-ink hover:underline">
                                {s.name}
                              </Link>
                              <span className="block truncate text-[12px] text-muted lg:hidden">{s.admissionNo}</span>
                              {s.tags.length > 0 && <span className="hidden truncate text-[12px] text-muted lg:block">{s.tags[0]}</span>}
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <span className="font-medium text-ink">{classLabel(s.grade, s.section)}</span>
                          <span className="tnum block text-[12px] text-muted">Roll {s.roll}</span>
                        </Td>
                        <Td className="tnum hidden text-ink-2 lg:table-cell">{s.admissionNo}</Td>
                        <Td>
                          <HouseTag house={s.house} />
                        </Td>
                        <Td>
                          <span className="block max-w-[200px] truncate text-ink-2">{g.name}</span>
                          <span className="tnum block text-[12px] text-muted">{g.phone}</span>
                        </Td>
                        <Td className="hidden xl:table-cell">
                          {s.routeId ? (
                            <>
                              <span className="text-ink-2">Bus {s.routeId}</span>
                              <span className="block max-w-[160px] truncate text-[12px] text-muted">{s.locality}</span>
                            </>
                          ) : (
                            <span className="text-muted">Own</span>
                          )}
                        </Td>
                        <Td>
                          <FeeBadge acc={acc} />
                        </Td>
                        <Td className="text-faint">
                          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:text-muted" aria-hidden />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Phone list */}
            <ul className="border-t border-line md:hidden">
              {pageRows.map(({ s, acc }) => (
                <li key={s.id} className="border-b border-line last:border-b-0">
                  <Link href={`/students/${s.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                    <Avatar name={s.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13.5px] font-medium text-ink">{s.name}</span>
                        <FeeBadge acc={acc} compact />
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-muted">
                        <span className="font-medium text-ink-2">{classLabel(s.grade, s.section)}</span>
                        <span>· Roll {s.roll}</span>
                        <span>·</span>
                        <span className="truncate">{s.guardians[0].name}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} noun="students" />
          </>
        )}
      </Card>

      <AddStudentDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

