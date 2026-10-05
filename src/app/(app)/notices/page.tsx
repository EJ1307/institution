"use client";

import { Suspense } from "react";
import { NoticeBoard } from "@/components/notices/NoticeBoard";
import { ParentNotices } from "@/components/notices/ParentNotices";
import { useRole } from "@/lib/session";

function Notices() {
  const role = useRole();
  return role === "parent" ? <ParentNotices /> : <NoticeBoard />;
}

export default function NoticesPage() {
  return (
    <Suspense>
      <Notices />
    </Suspense>
  );
}
