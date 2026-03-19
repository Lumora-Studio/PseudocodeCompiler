const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Preserve Expo defaults and add the monorepo root for workspace resolution.
config.watchFolders = [...(config.watchFolders || []), monorepoRoot];

// Resolve packages from both the mobile app and the monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Bundle .html files as assets so they can be loaded into WebViews
config.resolver.assetExts = Array.from(
  new Set([...(config.resolver.assetExts || []), "html"])
);

module.exports = config;
