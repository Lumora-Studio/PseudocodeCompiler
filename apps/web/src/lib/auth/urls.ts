export type AuthFlowMode = "sign-in" | "sign-up";

export interface AuthRequestContext {
  headers: Pick<Headers, "get">;
  url: string;
  nextUrl?: Pick<URL, "origin">;
}

function isLoopbackHost(hostname: string): boolean {
  const normalizedHost = hostname.trim().toLowerCase();
  return (
    normalizedHost === "localhost" ||
    normalizedHost.endsWith(".localhost") ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "[::1]" ||
    normalizedHost === "::1"
  );
}

function isVercelHostname(hostname: string): boolean {
  return hostname.trim().toLowerCase().endsWith(".vercel.app");
}

function getConfiguredRedirectUri(request?: AuthRequestContext): string | undefined {
  const configuredRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  if (!configuredRedirectUri) {
    return undefined;
  }

  try {
    const parsedConfiguredRedirectUri = new URL(configuredRedirectUri);
    if (request) {
      const requestBaseUrl = resolveRequestBaseUrl(request);
      const requestHostname = new URL(requestBaseUrl).hostname;

      if (
        !isLoopbackHost(requestHostname) &&
        !isVercelHostname(requestHostname) &&
        isVercelHostname(parsedConfiguredRedirectUri.hostname)
      ) {
        return undefined;
      }

      if (isLoopbackHost(parsedConfiguredRedirectUri.hostname)) {
        if (isLoopbackHost(requestHostname)) {
          return parsedConfiguredRedirectUri.toString();
        }

        return undefined;
      }
    }

    return parsedConfiguredRedirectUri.toString();
  } catch {
    return undefined;
  }
}

function getConfiguredBaseUrl(request?: AuthRequestContext): string | undefined {
  const configuredRedirectUri = getConfiguredRedirectUri(request);
  if (!configuredRedirectUri) {
    return undefined;
  }

  return new URL(configuredRedirectUri).origin;
}

function getCanonicalProductionBaseUrl(): string | undefined {
  const configuredHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  if (!configuredHost) {
    return undefined;
  }

  const trimmedHost = configuredHost.trim();
  if (!trimmedHost) {
    return undefined;
  }

  try {
    const parsedUrl = trimmedHost.includes("://")
      ? new URL(trimmedHost)
      : new URL(`https://${trimmedHost}`);
    if (isLoopbackHost(parsedUrl.hostname)) {
      return undefined;
    }
    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch {
    return undefined;
  }
}

function getForwardedHeaderValue(headers: Pick<Headers, "get">, name: string): string | null {
  const value = headers.get(name);
  if (!value) {
    return null;
  }

  const [firstValue] = value.split(",");
  const trimmed = firstValue?.trim();
  return trimmed ? trimmed : null;
}

function resolveRequestBaseUrl(request: AuthRequestContext): string {
  const forwardedHost = getForwardedHeaderValue(request.headers, "x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto =
      getForwardedHeaderValue(request.headers, "x-forwarded-proto") ??
      request.nextUrl?.origin.split("://")[0] ??
      new URL(request.url).protocol.replace(/:$/, "");

    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl?.origin ?? new URL(request.url).origin;
}

export function resolveAuthBaseUrl(request: AuthRequestContext): string {
  const configuredBaseUrl = getConfiguredBaseUrl(request);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const requestBaseUrl = resolveRequestBaseUrl(request);
  try {
    const parsedRequestBaseUrl = new URL(requestBaseUrl);
    if (
      !isLoopbackHost(parsedRequestBaseUrl.hostname) &&
      !isVercelHostname(parsedRequestBaseUrl.hostname)
    ) {
      return parsedRequestBaseUrl.origin;
    }
  } catch {
    // Fall through to the canonical production domain or request origin.
  }

  const canonicalProductionBaseUrl = getCanonicalProductionBaseUrl();
  if (canonicalProductionBaseUrl) {
    return canonicalProductionBaseUrl;
  }

  return requestBaseUrl;
}

export function resolveAuthRedirectUri(request: AuthRequestContext): string {
  const configuredRedirectUri = getConfiguredRedirectUri(request);
  if (configuredRedirectUri) {
    return configuredRedirectUri;
  }

  return new URL("/callback", resolveAuthBaseUrl(request)).toString();
}

export function normalizeAuthReturnTo(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return undefined;
  }

  try {
    const url = new URL(value, "https://placeholder.invalid");
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

export function getAuthRouteHref(mode: AuthFlowMode, returnTo?: string | null): string {
  const pathname = mode === "sign-in" ? "/login" : "/signup";
  const normalizedReturnTo = normalizeAuthReturnTo(returnTo) ?? "/";

  return `${pathname}?returnTo=${encodeURIComponent(normalizedReturnTo)}`;
}

export function getLogoutRouteHref(returnTo?: string | null): string {
  const normalizedReturnTo = normalizeAuthReturnTo(returnTo) ?? "/";
  return `/logout?returnTo=${encodeURIComponent(normalizedReturnTo)}`;
}
