interface NavigatorLike {
  maxTouchPoints?: number;
  platform?: string;
  userAgent?: string;
}

interface MediaQueryListLike {
  matches: boolean;
}

type MatchMediaLike = (query: string) => MediaQueryListLike;

export function isAppleTouchDevice(navigatorLike?: NavigatorLike | null): boolean {
  if (!navigatorLike) {
    return false;
  }

  const userAgent = navigatorLike.userAgent ?? "";
  const platform = navigatorLike.platform ?? "";
  const maxTouchPoints = navigatorLike.maxTouchPoints ?? 0;

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function supportsDesktopNativeDragAndDrop(
  matchMedia?: MatchMediaLike,
  navigatorLike?: NavigatorLike | null,
): boolean {
  if (isAppleTouchDevice(navigatorLike)) {
    return false;
  }

  if (typeof matchMedia !== "function") {
    return true;
  }

  return !matchMedia("(pointer: coarse)").matches;
}
