import type { AccessToken } from "@workos-inc/authkit-nextjs";
import { decodeJwt } from "jose";
import { NextResponse } from "next/server";
import { getWorkOsSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export async function GET() {
  const session = await getWorkOsSession();
  if (!session) {
    return NextResponse.json(
      { user: null },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  }

  try {
    const {
      sid: sessionId,
      org_id: organizationId,
      role,
      roles,
      permissions,
      entitlements,
      feature_flags: featureFlags,
    } = decodeJwt<AccessToken>(session.accessToken);

    return NextResponse.json(
      {
        user: session.user,
        sessionId,
        organizationId,
        role,
        roles,
        permissions,
        entitlements,
        featureFlags,
        impersonator: session.impersonator,
      },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  } catch {
    return NextResponse.json(
      { user: null },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  }
}
