"use client";

import { ConvexReactClient } from "convex/react";

const DEFAULT_CONVEX_URL = "https://different-deer-512.convex.cloud";
const PRODUCTION_CONVEX_URL = "https://dashing-gnat-823.convex.cloud";
const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  (process.env.NEXT_PUBLIC_APP_RUNTIME === "cloud" ? PRODUCTION_CONVEX_URL : DEFAULT_CONVEX_URL);

let convexClient: ConvexReactClient | null | undefined;

export function getConvexClient(): ConvexReactClient | null {
  if (convexClient !== undefined) {
    return convexClient;
  }

  convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;
  return convexClient;
}

export function isConvexConfigured(): boolean {
  return Boolean(convexUrl);
}
