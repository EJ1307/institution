"use client";

import { ArrowLeft, ChevronRight, IdCard, Lock, MessageSquareText, UserX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Tabs } from "@/components/ui/forms";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { Avatar, Badge, Button, ButtonLink, Card } from "@/components/ui/primitives";
import { academicYear, today as todayFn } from "@/lib/data/calendar";
import { PERSONA_TEACHER_ID, studentById } from "@/lib/data/people";
import { GRADE_BY_ID, STREAMS, classLabel } from "@/lib/data/school";
import { useRole, useTeacher } from "@/lib/session";
import { IdCardDialog } from "./IdCardDialog";
import { MessageParentsDialog } from "./MessageParentsDialog";
import { medicalFor } from "./profileData";
import { ProfileAcademics } from "./ProfileAcademics";
import { ProfileAttendance } from "./ProfileAttendance";
import { ProfileDocuments } from "./ProfileDocuments";
import { ProfileFees } from "./ProfileFees";
import { ProfileOverview } from "./ProfileOverview";
import { houseColor } from "./shared";
import { teacherClasses } from "./TeacherStudents";

export type ProfileTab = "overview" | "attendance" | "academics" | "fees" | "documents";

export function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const role = useRole();
  const teacher = useTeacher();
  const [dialog, setDialog] = useState<"id" | "message" | null>(null);

  const s = studentById(decodeURIComponent(id ?? ""));
  const myClasses = useMemo(() => (role === "teacher" ? teacherClasses(PERSONA_TEACHER_ID, teacher.classTeacherOf).map((c) => c.key) : []), [role, teacher.classTeacherOf]);

  if (!s) {
    return (
      <>
        <PageHeader breadcrumbs={[{ label: "Students", href: "/students" }, { label: "Not found" }]} title="Student not found" />
        <Card>
          <EmptyState
            icon={<UserX />}
            title={`There's no student with the ID “${decodeURIComponent(id ?? "")}”`}
            body="They may have left the school, or the link is mistyped. Search the directory by name, admission number or a parent's phone number."
            action={
              <ButtonLink href="/students" variant="primary" size="sm">
                <ArrowLeft /> Back to students
              </ButtonLink>
            }
            className="py-20"
          />
        </Card>
      </>
    );
  }

  if (role === "teacher" && !myClasses.includes(s.classKey)) {
    return (
      <>
        <PageHeader breadcrumbs={[{ label: "My students", href: "/students" }, { label: s.name }]} title={s.name} />
        <Card>
          <EmptyState
            icon={<Lock />}
            title={`${s.firstName} isn't in a class you teach`}
            body={`Teachers can open profiles for the sections on their timetable. ${s.firstName} is in ${classLabel(s.grade, s.section)} — ask the class teacher or the coordinator if you need their record.`}
            action={
              <ButtonLink href="/students" size="sm">
                <ArrowLeft /> My students
              </ButtonLink>
            }
            className="py-20"
          />
        </Card>
      </>
    );
  }

  const isAdmin = role === "admin";
  const ownClass = role === "teacher" && s.classKey === teacher.classTeacherOf;
  const canFees = isAdmin || ownClass;
  const tabs: { value: ProfileTab; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "attendance", label: "Attendance" },
    { value: "academics", label: "Academics" },
    ...(isAdmin ? [{ value: "fees" as const, label: "Fees" }] : []),
    { value: "documents", label: "Documents" },
  ];
  const requested = params.get("tab") as ProfileTab | null;
  const tab: ProfileTab = requested && tabs.some((t) => t.value === requested) ? requested : "overview";
  const setTab = (t: ProfileTab) => router.replace(t === "overview" ? `/students/${s.id}` : `/students/${s.id}?tab=${t}`, { scroll: false });

  const g = GRADE_BY_ID[s.grade];
  const ay = academicYear();
  const med = medicalFor(s, todayFn());
  const medicalLine = [med.allergies.length ? `Allergic to ${med.allergies.join(", ").toLowerCase()}` : "No known allergies", ...med.conditions.map((c) => c.split(" — ")[0])].join(" · ");

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-[12.5px] text-muted">
        <Link href="/students" className="hover:text-ink">
          {role === "teacher" ? "My students" : "Students"}
        </Link>
        <ChevronRight className="size-3.5 text-faint" aria-hidden />
        <Link href={`/students?class=${s.classKey}`} className="hover:text-ink">
          {classLabel(s.grade, s.section)}
        </Link>
        <ChevronRight className="size-3.5 text-faint" aria-hidden />
        <span className="truncate text-ink-2">{s.name}</span>
      </nav>

      <header className="mb-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <Avatar name={s.name} size={64} />
          <div className="min-w-0">
            <h1 className="title-serif text-[26px] leading-[1.15] font-semibold text-ink sm:text-[30px]">{s.name}</h1>
            <p className="tnum mt-1 text-[13.5px] text-muted">
              <span className="font-medium text-ink-2">
                {g.label} {s.section}
              </span>
              {g.stage === "Senior secondary" && <span> ({STREAMS[s.section]})</span>}
              <span> · Roll {s.roll}</span>
              <span className="whitespace-nowrap"> · Adm. no. {s.admissionNo}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="outline">
                <span className="size-1.5 rounded-full" style={{ background: houseColor(s.house) }} />
                {s.house} House
              </Badge>
              {s.tags.map((t) => (
                <Badge key={t} tone="brand">
                  {t}
                </Badge>
              ))}
              {s.joinedYear === ay.startYear && <Badge tone="info">New this year</Badge>}
              {s.concession && canFees && <Badge tone="neutral">{s.concession.label === "EWS (RTE)" ? "RTE seat" : `${s.concession.label} concession · ${s.concession.pct}%`}</Badge>}
              {s.routeId && <Badge tone="neutral">Bus {s.routeId}</Badge>}
              {(med.allergies.length > 0 || med.conditions.length > 0) && <Badge tone="warn">Medical note</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setDialog("message")}>
            <MessageSquareText /> Message parents
          </Button>
          <Button variant="secondary" onClick={() => setDialog("id")}>
            <IdCard /> Print ID card
          </Button>
        </div>
      </header>

      <Tabs value={tab} onChange={setTab} tabs={tabs} className="mb-5" />

      {tab === "overview" && <ProfileOverview student={s} canFees={canFees} canLedger={isAdmin} onTab={setTab} />}
      {tab === "attendance" && <ProfileAttendance student={s} />}
      {tab === "academics" && <ProfileAcademics student={s} />}
      {tab === "fees" && isAdmin && <ProfileFees student={s} />}
      {tab === "documents" && <ProfileDocuments student={s} canEdit={isAdmin} />}

      <IdCardDialog student={s} open={dialog === "id"} onClose={() => setDialog(null)} medical={medicalLine} />
      <MessageParentsDialog student={s} open={dialog === "message"} onClose={() => setDialog(null)} canFees={canFees} />
    </>
  );
}
