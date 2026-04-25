import { handleAuth } from "@workos-inc/authkit-nextjs";
import type { NextRequest } from "next/server";
import { resolveAuthBaseUrl } from "@/lib/auth/urls";

export const GET = async (request: NextRequest) => {
  const handler = handleAuth({
    baseURL: resolveAuthBaseUrl(request),
  });

  return handler(request);
};
