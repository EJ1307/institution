"use client";

import { AdminDashboard } from "@/components/dashboards/AdminDashboard";
import { ParentDashboard } from "@/components/dashboards/ParentDashboard";
import { TeacherDashboard } from "@/components/dashboards/TeacherDashboard";
import { useRole } from "@/lib/session";

export default function DashboardPage() {
  const role = useRole();
  if (role === "teacher") return <TeacherDashboard />;
  if (role === "parent") return <ParentDashboard />;
  return <AdminDashboard />;
}
