import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

const hasClerkServerConfig = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);
const isElectronBuild = process.env.BUILD_TARGET === "electron";
const shouldUseClerkProxy = !isElectronBuild && hasClerkServerConfig;

const clerkProxy = shouldUseClerkProxy ? clerkMiddleware() : null;

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!clerkProxy) {
    return NextResponse.next();
  }

  return clerkProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
