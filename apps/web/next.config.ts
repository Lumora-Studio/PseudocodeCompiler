import type { NextConfig } from "next";
import path from "node:path";

const isElectronBuild = process.env.BUILD_TARGET === "electron";
const monorepoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  output: isElectronBuild ? "export" : undefined,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@igcse/compiler", "@igcse/workspace"],
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
