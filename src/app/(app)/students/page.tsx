"use client";

import { Suspense } from "react";
import { StudentDirectory } from "@/components/students/StudentDirectory";
import { TeacherStudents } from "@/components/students/TeacherStudents";
import { useRole } from "@/lib/session";

function StudentsInner() {
  const role = useRole();
  return role === "teacher" ? <TeacherStudents /> : <StudentDirectory />;
}

export default function StudentsPage() {
  return (
    <Suspense>
      <StudentsInner />
    </Suspense>
  );
}
