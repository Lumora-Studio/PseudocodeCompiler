export type AppRuntime = "cloud" | "local";

const appRuntime: AppRuntime =
  process.env.NEXT_PUBLIC_APP_RUNTIME === "local" ? "local" : "cloud";

export function getAppRuntime(): AppRuntime {
  return appRuntime;
}

export function isLocalAppRuntime(): boolean {
  return appRuntime === "local";
}

export function isCloudAppRuntime(): boolean {
  return appRuntime === "cloud";
}
