"use client";

import { Suspense } from "react";
import { StudentProfile } from "@/components/students/StudentProfile";

export default function StudentProfilePage() {
  return (
    <Suspense>
      <StudentProfile />
    </Suspense>
  );
}
