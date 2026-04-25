import type { AccessToken } from "@workos-inc/authkit-nextjs";
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import { decodeJwt } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getWorkOsSession, saveWorkOsSession } from "@/lib/auth/session";

const TOKEN_REFRESH_BUFFER_SECONDS = 60;

function isTokenExpiringSoon(accessToken: string): boolean {
  try {
    const { exp } = decodeJwt<AccessToken>(accessToken);
    if (typeof exp !== "number") {
      return true;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return exp <= nowInSeconds + TOKEN_REFRESH_BUFFER_SECONDS;
  } catch {
    return true;
  }
}

export async function GET(request: NextRequest) {
  const session = await getWorkOsSession();
  if (!session) {
    return NextResponse.json(
      { accessToken: null },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  let accessToken = session.accessToken;
  const shouldForceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (shouldForceRefresh || isTokenExpiringSoon(accessToken)) {
    const clientId = process.env.WORKOS_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        {
          accessToken: null,
          error: "WORKOS_CLIENT_ID is not configured.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    try {
      const decoded = decodeJwt<AccessToken>(accessToken);
      const refreshedSession = await getWorkOS().userManagement.authenticateWithRefreshToken({
        clientId,
        refreshToken: session.refreshToken,
        organizationId: decoded.org_id,
      });

      accessToken = refreshedSession.accessToken;
      await saveWorkOsSession(
        {
          accessToken: refreshedSession.accessToken,
          refreshToken: refreshedSession.refreshToken,
          user: refreshedSession.user,
          impersonator: refreshedSession.impersonator,
        },
        request.url,
      );
    } catch {
      return NextResponse.json(
        {
          accessToken: null,
          error: "Unable to refresh WorkOS session.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }
  }

  return NextResponse.json(
    { accessToken },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
