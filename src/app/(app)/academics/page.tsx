"use client";

import { AdminResults } from "@/components/academics/AdminResults";
import { ParentReportCard } from "@/components/academics/ParentReportCard";
import { TeacherGradebook } from "@/components/academics/TeacherGradebook";
import { useRole } from "@/lib/session";

export default function AcademicsPage() {
  const role = useRole();
  if (role === "teacher") return <TeacherGradebook />;
  if (role === "parent") return <ParentReportCard />;
  return <AdminResults />;
}
