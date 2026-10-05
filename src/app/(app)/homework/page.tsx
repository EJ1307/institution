"use client";

import { Suspense } from "react";
import { ParentHomework } from "@/components/homework/ParentHomework";
import { TeacherHomework } from "@/components/homework/TeacherHomework";
import { useRole } from "@/lib/session";

function Homework() {
  const role = useRole();
  return role === "parent" ? <ParentHomework /> : <TeacherHomework />;
}

export default function HomeworkPage() {
  return (
    <Suspense>
      <Homework />
    </Suspense>
  );
}
