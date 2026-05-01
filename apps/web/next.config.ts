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
          "@clerk/nextjs": "./src/lib/clerk-electron-components.tsx",
          "@clerk/nextjs/server": "./src/lib/clerk-electron-server.ts",
        }
      : undefined,
  },
};

export default nextConfig;
