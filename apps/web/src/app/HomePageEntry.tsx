"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { HomePageShell } from "@/app/HomePageShell";

const HomePageClient = dynamic(() => import("@/app/HomePageClient"), {
  ssr: false,
  loading: () => <HomePageShell message="Loading the editor workspace…" />,
});

export function HomePageEntry() {
  const [shouldMountApp, setShouldMountApp] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setShouldMountApp(true);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  if (!shouldMountApp) {
    return <HomePageShell />;
  }

  return <HomePageClient />;
}
