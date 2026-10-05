"use client";

import { Suspense } from "react";
import { AdminTransport } from "@/components/transport/AdminTransport";
import { ParentTransport } from "@/components/transport/ParentTransport";
import { useRole } from "@/lib/session";

export default function TransportPage() {
  return (
    <Suspense>
      <Transport />
    </Suspense>
  );
}

function Transport() {
  const role = useRole();
  if (role === "parent") return <ParentTransport />;
  if (role === "admin") return <AdminTransport />;
  return null;
}
