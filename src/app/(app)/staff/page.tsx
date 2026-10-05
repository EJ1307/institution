"use client";

import { Suspense } from "react";
import { StaffPage } from "@/components/staff/StaffPage";

export default function StaffRoute() {
  return (
    <Suspense>
      <StaffPage />
    </Suspense>
  );
}
