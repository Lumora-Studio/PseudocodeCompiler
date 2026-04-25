#!/usr/bin/env node

const { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const appDir = path.resolve(__dirname, "..");
const tempRoot = path.join(appDir, ".electron-build-temp", "auth-routes");
const authRuntimePath = path.join(appDir, "src", "lib", "auth-runtime.ts");
const cloudOnlyRoutePaths = [
  path.join("src", "app", "api"),
  path.join("src", "app", "callback"),
  path.join("src", "app", "login"),
  path.join("src", "app", "logout"),
  path.join("src", "app", "signup"),
];

const movedDirs = [];
let exitCode = 1;

function hideAuthRoutes() {
  mkdirSync(tempRoot, { recursive: true });

  const authRuntimeBackupPath = path.join(tempRoot, "auth-runtime.ts");
  if (!existsSync(authRuntimePath)) {
    throw new Error(`Auth runtime file not found: ${authRuntimePath}`);
  }
  if (existsSync(authRuntimeBackupPath)) {
    throw new Error(`Temporary auth runtime backup already exists: ${authRuntimeBackupPath}`);
  }

  writeFileSync(authRuntimeBackupPath, readFileSync(authRuntimePath, "utf8"));
  writeFileSync(
    authRuntimePath,
    [
      'export { AppAuthProvider, useAppAuth } from "@/lib/auth/electron";',
      'export type { AppAuthInitialState, AppAuthState, AppAuthUser } from "@/lib/auth/web";',
      "",
    ].join("\n"),
  );

  for (const relativeRoutePath of cloudOnlyRoutePaths) {
    const routeDir = path.join(appDir, relativeRoutePath);
    if (!existsSync(routeDir)) {
      continue;
    }

    const backupDir = path.join(tempRoot, relativeRoutePath);
    if (existsSync(backupDir)) {
      throw new Error(`Temporary auth route backup already exists: ${backupDir}`);
    }

    mkdirSync(path.dirname(backupDir), { recursive: true });
    renameSync(routeDir, backupDir);
    movedDirs.push({ routeDir, backupDir });
  }
}

function restoreAuthRoutes() {
  const authRuntimeBackupPath = path.join(tempRoot, "auth-runtime.ts");
  if (existsSync(authRuntimeBackupPath)) {
    writeFileSync(authRuntimePath, readFileSync(authRuntimeBackupPath, "utf8"));
  }

  for (const { routeDir, backupDir } of movedDirs.reverse()) {
    if (!existsSync(backupDir)) {
      continue;
    }

    renameSync(backupDir, routeDir);
  }

  rmSync(path.join(appDir, ".electron-build-temp"), { recursive: true, force: true });
}

try {
  hideAuthRoutes();

  const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], {
    cwd: appDir,
    stdio: "inherit",
    env: {
      ...process.env,
      BUILD_TARGET: "electron",
      NEXT_PUBLIC_APP_RUNTIME: "local",
    },
  });

  if (result.error) {
    throw result.error;
  }

  exitCode = result.status ?? 1;
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Electron web build failed before Next.js ran.",
  );
  exitCode = 1;
} finally {
  restoreAuthRoutes();
  process.exit(exitCode);
}
