"use client";

import { Suspense } from "react";
import { AdminTimetable } from "@/components/timetable/AdminTimetable";
import { TeacherTimetable } from "@/components/timetable/TeacherTimetable";
import { useRole } from "@/lib/session";

function TimetableInner() {
  const role = useRole();
  if (role === "teacher") return <TeacherTimetable />;
  return <AdminTimetable />;
}

export default function TimetablePage() {
  return (
    <Suspense>
      <TimetableInner />
    </Suspense>
  );
}
