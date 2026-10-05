"use client";

import { Suspense } from "react";
import { AdminAttendance } from "@/components/attendance/AdminAttendance";
import { ParentAttendance } from "@/components/attendance/ParentAttendance";
import { TeacherAttendance } from "@/components/attendance/TeacherAttendance";
import { useRole } from "@/lib/session";

function AttendanceInner() {
  const role = useRole();
  if (role === "teacher") return <TeacherAttendance />;
  if (role === "parent") return <ParentAttendance />;
  return <AdminAttendance />;
}

export default function AttendancePage() {
  return (
    <Suspense>
      <AttendanceInner />
    </Suspense>
  );
}
