"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getState } from "@/lib/store";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getState().session ? "/dashboard" : "/login");
  }, [router]);
  return null;
}
