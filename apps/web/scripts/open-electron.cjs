#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const electronPath = require("electron");
const appPath = path.join(__dirname, "..");

const child = spawn(electronPath, [appPath], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
  env: {
    ...process.env,
    ELECTRON_START_URL: process.env.ELECTRON_START_URL || "http://localhost:3000",
    NEXT_PUBLIC_RESET_WORKSPACE_ON_DEV:
      process.env.NEXT_PUBLIC_RESET_WORKSPACE_ON_DEV || "1",
  },
});

child.unref();
