"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session";

export default function Home() {
  const { user, loading } = useSession();
  const router = useRouter();
  useEffect(() => { if (!loading) router.replace(user ? "/start" : "/login"); }, [user, loading, router]);
  return <p className="muted">Loading…</p>;
}
