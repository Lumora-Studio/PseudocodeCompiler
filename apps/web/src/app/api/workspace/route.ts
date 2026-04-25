import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

const isElectronBuild = process.env.BUILD_TARGET === "electron";

function getConvexClient() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL or CONVEX_URL.");
  }

  return new ConvexHttpClient(convexUrl);
}

function getWorkspaceSyncSecret() {
  const serverSecret = process.env.WORKSPACE_SYNC_SECRET;
  if (!serverSecret) {
    throw new Error("Missing WORKSPACE_SYNC_SECRET.");
  }

  return serverSecret;
}

export async function GET() {
  if (isElectronBuild) {
    return NextResponse.json({ workspace: null }, { status: 404 });
  }

  const auth = await withAuth({ ensureSignedIn: true });
  const workspace = await getConvexClient().query(api.workspaces.getCurrent, {
    serverSecret: getWorkspaceSyncSecret(),
    workosUserId: auth.user.id,
  });

  return NextResponse.json({ workspace });
}

export async function PUT(request: Request) {
  if (isElectronBuild) {
    return NextResponse.json(
      { error: "Workspace cloud sync is unavailable in desktop builds." },
      { status: 404 },
    );
  }

  const auth = await withAuth({ ensureSignedIn: true });
  const body = (await request.json()) as { workspace?: unknown };

  if (!("workspace" in body)) {
    return NextResponse.json({ error: "Missing workspace payload." }, { status: 400 });
  }

  await getConvexClient().mutation(api.workspaces.saveCurrent, {
    serverSecret: getWorkspaceSyncSecret(),
    user: {
      workosUserId: auth.user.id,
      email: auth.user.email,
      firstName: auth.user.firstName ?? null,
      lastName: auth.user.lastName ?? null,
    },
    workspace: body.workspace,
  });

  return NextResponse.json({ ok: true });
}
