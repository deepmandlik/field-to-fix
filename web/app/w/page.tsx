"use client";

import { WatchApp } from "@/components/Watch";

/** Full-screen watch view for real watch or phone browsers. The Shell renders it without the sidebar. */
export default function WatchFull() {
  return <main className="wa-full"><WatchApp /></main>;
}
