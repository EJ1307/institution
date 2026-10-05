"use client";

import { Suspense } from "react";
import { AdmissionsPage } from "@/components/admissions/AdmissionsPage";

export default function AdmissionsRoute() {
  return (
    <Suspense>
      <AdmissionsPage />
    </Suspense>
  );
}
