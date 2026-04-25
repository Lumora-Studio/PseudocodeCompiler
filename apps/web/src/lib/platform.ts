export type AppPlatform = "browser" | "desktop";

export type WorkspacePersistenceMode = "memory" | "local" | "cloud";

interface ElectronBridge {
  isDesktop?: boolean;
}

export function getClientAppPlatform(): AppPlatform {
  if (typeof window === "undefined") {
    return "browser";
  }

  const electronWindow = window as Window & { electron?: ElectronBridge };
  return electronWindow.electron?.isDesktop ? "desktop" : "browser";
}

export function getWorkspacePersistenceMode({
  platform,
  signedIn,
}: {
  platform: AppPlatform;
  signedIn: boolean;
}): WorkspacePersistenceMode {
  if (platform === "desktop") {
    return "local";
  }

  return signedIn ? "cloud" : "memory";
}

export function platformUsesCloudSaving(platform: AppPlatform): boolean {
  return platform === "browser";
}
