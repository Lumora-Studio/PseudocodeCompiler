import type { NextConfig } from "next";
import path from "node:path";

const isElectronBuild = process.env.BUILD_TARGET === "electron";
const monorepoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  output: isElectronBuild ? "export" : undefined,
  pageExtensions: isElectronBuild ? ["tsx", "jsx"] : undefined,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@igcse/compiler", "@igcse/workspace"],
  turbopack: {
    root: monorepoRoot,
    resolveAlias: isElectronBuild
      ? {
          "@workos-inc/authkit-nextjs": "./src/lib/authkit-electron-server.ts",
          "@workos-inc/authkit-nextjs/components":
            "./src/lib/authkit-electron-components.tsx",
        }
      : undefined,
  },
};

export default nextConfig;
