import { handleAuth } from "@workos-inc/authkit-nextjs";

const isElectronBuild = process.env.BUILD_TARGET === "electron";

const handleBrowserAuth = handleAuth({ returnPathname: "/" });

export const GET = isElectronBuild
  ? async () => new Response(null, { status: 404 })
  : handleBrowserAuth;
