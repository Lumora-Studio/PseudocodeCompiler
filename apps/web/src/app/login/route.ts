import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

const isElectronBuild = process.env.BUILD_TARGET === "electron";

export const GET = async () => {
  if (isElectronBuild) {
    return new Response(null, { status: 404 });
  }

  const signInUrl = await getSignInUrl({ returnTo: "/" });
  redirect(signInUrl);
};
