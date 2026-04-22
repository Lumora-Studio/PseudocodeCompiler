import type { NextConfig } from "next";
import path from "node:path";

const isElectronBuild = process.env.BUILD_TARGET === "electron";
const monorepoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  output: isElectronBuild ? "export" : undefined,
  outputFileTracingRoot: monorepoRoot,
  images: {
    unoptimized: isElectronBuild,
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  transpilePackages: ["@pseudocode-compiler/compiler", "@pseudocode-compiler/workspace"],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
