import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { normalizeAuthReturnTo, resolveAuthRedirectUri } from "@/lib/auth/urls";

export const GET = async (request: NextRequest) => {
  const signUpUrl = await getSignUpUrl({
    redirectUri: resolveAuthRedirectUri(request),
    returnTo: normalizeAuthReturnTo(request.nextUrl.searchParams.get("returnTo")),
  });
  return redirect(signUpUrl);
};
