import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { normalizeAuthReturnTo, resolveAuthRedirectUri } from "@/lib/auth/urls";

export const GET = async (request: NextRequest) => {
  const signInUrl = await getSignInUrl({
    redirectUri: resolveAuthRedirectUri(request),
    returnTo: normalizeAuthReturnTo(request.nextUrl.searchParams.get("returnTo")),
  });
  return redirect(signInUrl);
};
