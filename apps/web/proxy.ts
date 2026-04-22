import { authkit, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";
import { resolveAuthRedirectUri } from "@/lib/auth/urls";

export default async function proxy(request: NextRequest) {
  const { headers } = await authkit(request, {
    redirectUri: resolveAuthRedirectUri(request),
    eagerAuth: true,
  });

  return handleAuthkitHeaders(request, headers);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
