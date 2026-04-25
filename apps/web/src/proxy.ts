import type { NextRequest } from "next/server";
import { authkit, handleAuthkitHeaders } from "@workos-inc/authkit-nextjs";

export default async function proxy(request: NextRequest) {
  const redirectUri =
    process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? new URL("/callback", request.url).toString();
  const { headers } = await authkit(request, { redirectUri });
  return handleAuthkitHeaders(request, headers);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)",
  ],
};
