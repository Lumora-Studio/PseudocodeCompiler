import { signOut } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";
import { normalizeAuthReturnTo } from "@/lib/auth/urls";

export async function GET(request: NextRequest) {
  const returnPath =
    normalizeAuthReturnTo(request.nextUrl.searchParams.get("returnTo")) ?? "/";
  const returnTo = new URL(returnPath, request.nextUrl.origin).toString();

  return signOut({ returnTo });
}
