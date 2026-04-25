import { signOut } from "@workos-inc/authkit-nextjs";

const isElectronBuild = process.env.BUILD_TARGET === "electron";

export const GET = async () => {
  if (isElectronBuild) {
    return new Response(null, { status: 404 });
  }

  await signOut({ returnTo: "/" });
};
