export type AppPlatform = "browser" | "local" | "desktop";

export type WorkspacePersistenceMode = "memory" | "local" | "cloud";

interface ElectronBridge {
  isDesktop?: boolean;
}

export function getClientAppPlatform(): AppPlatform {
  if (typeof window === "undefined") {
    return "browser";
  }

  const electronWindow = window as Window & { electron?: ElectronBridge };
  if (electronWindow.electron?.isDesktop) {
    return "desktop";
  }

  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "local";
  }

  return "browser";
}

export function getWorkspacePersistenceMode({
  platform,
  signedIn,
}: {
  platform: AppPlatform;
  signedIn: boolean;
}): WorkspacePersistenceMode {
  if (platform === "desktop" || platform === "local") {
    return "local";
  }

  return signedIn ? "cloud" : "memory";
}

export function platformUsesCloudSaving(platform: AppPlatform): boolean {
  return platform === "browser";
}
