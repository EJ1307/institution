"use client";

import { Suspense } from "react";
import { AdminFees } from "@/components/fees/AdminFees";
import { ParentFees } from "@/components/fees/ParentFees";
import { useRole } from "@/lib/session";

export default function FeesPage() {
  return (
    <Suspense>
      <Fees />
    </Suspense>
  );
}

function Fees() {
  const role = useRole();
  if (role === "parent") return <ParentFees />;
  if (role === "admin") return <AdminFees />;
  return null;
}
