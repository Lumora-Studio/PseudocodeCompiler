import type { Session } from "@workos-inc/authkit-nextjs";
import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";

const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

function getCookiePassword(): string | undefined {
  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password || password.length < 32) {
    return undefined;
  }

  return password;
}

export function getWorkOsSessionCookieName(): string {
  return process.env.WORKOS_COOKIE_NAME || "wos-session";
}

function resolveCookieSecure(requestUrl?: string): boolean {
  if (requestUrl) {
    try {
      return new URL(requestUrl).protocol === "https:";
    } catch {
      return true;
    }
  }

  const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  if (redirectUri) {
    try {
      return new URL(redirectUri).protocol === "https:";
    } catch {
      return true;
    }
  }

  return process.env.NODE_ENV === "production";
}

export async function getWorkOsSession(): Promise<Session | undefined> {
  const password = getCookiePassword();
  if (!password) {
    return undefined;
  }

  const cookieStore = await cookies();
  const sealedSession = cookieStore.get(getWorkOsSessionCookieName())?.value;
  if (!sealedSession) {
    return undefined;
  }

  try {
    return await unsealData<Session>(sealedSession, { password });
  } catch {
    return undefined;
  }
}

export async function saveWorkOsSession(session: Session, requestUrl?: string): Promise<void> {
  const password = getCookiePassword();
  if (!password) {
    throw new Error("WORKOS_COOKIE_PASSWORD must be configured to save sessions.");
  }

  const sealedSession = await sealData(session, {
    password,
    ttl: 0,
  });

  const cookieStore = await cookies();
  cookieStore.set(getWorkOsSessionCookieName(), sealedSession, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: resolveCookieSecure(requestUrl),
    maxAge: DEFAULT_COOKIE_MAX_AGE_SECONDS,
  });
}
