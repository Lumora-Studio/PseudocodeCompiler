"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ConvexProviderWithAuth, useConvexAuth } from "convex/react";
import { getAuthRouteHref, getLogoutRouteHref } from "@/lib/auth/urls";
import { getConvexClient } from "@/lib/convex/client";

export interface AppAuthUser {
  id: string;
  email?: string | null;
  firstName?: string | null;
}

export interface AppAuthState {
  authAvailable: boolean;
  loading: boolean;
  cloudSyncLoading: boolean;
  cloudSyncReady: boolean;
  user: AppAuthUser | null;
  getAuth: (options?: { ensureSignedIn?: boolean }) => Promise<unknown>;
  signOut: (options?: { returnTo?: string }) => Promise<unknown>;
}

export interface AppAuthInitialState {
  user: AppAuthUser | null;
}

interface ConvexBridgeState {
  backendLoading: boolean;
  backendAuthenticated: boolean;
}

interface SessionPayload extends AppAuthInitialState {}

const ConvexBridgeContext = createContext<ConvexBridgeState>({
  backendLoading: false,
  backendAuthenticated: false,
});

const AppAuthContext = createContext<AppAuthState | undefined>(undefined);
const AUTH_REFRESH_TIMEOUT_MS = 800;

async function fetchSessionPayload(): Promise<SessionPayload> {
  try {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });

    if (!response.ok) {
      return { user: null };
    }

    const payload = (await response.json()) as SessionPayload;
    return {
      user: payload.user ?? null,
    };
  } catch {
    return { user: null };
  }
}

function useAuthContextValue() {
  const context = useContext(AppAuthContext);
  if (!context) {
    throw new Error("useAppAuth must be used within an AppAuthProvider");
  }

  return context;
}

function useAuthFromSessionForConvex() {
  const { user, loading: authLoading } = useAuthContextValue();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) {
        return null;
      }

      try {
        const response = await fetch(
          forceRefreshToken ? "/api/auth/access-token?refresh=1" : "/api/auth/access-token",
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          },
        );

        if (!response.ok) {
          return null;
        }

        const payload = (await response.json()) as {
          accessToken?: string | null;
        };
        return payload.accessToken ?? null;
      } catch {
        return null;
      }
    },
    [user],
  );

  return useMemo(
    () => ({
      isLoading: authLoading,
      isAuthenticated: Boolean(user),
      fetchAccessToken,
    }),
    [authLoading, fetchAccessToken, user],
  );
}

function ConvexBridgeProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const value = useMemo(
    () => ({
      backendLoading: isLoading,
      backendAuthenticated: isAuthenticated,
    }),
    [isAuthenticated, isLoading],
  );

  return <ConvexBridgeContext.Provider value={value}>{children}</ConvexBridgeContext.Provider>;
}

function LocalBridgeProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthContextValue();
  const value = useMemo(
    () => ({
      backendLoading: loading,
      backendAuthenticated: Boolean(user),
    }),
    [loading, user],
  );

  return <ConvexBridgeContext.Provider value={value}>{children}</ConvexBridgeContext.Provider>;
}

export function AppAuthProvider({
  children,
  initialAuth,
}: {
  children: ReactNode;
  initialAuth?: AppAuthInitialState;
}) {
  const [user, setUser] = useState<AppAuthUser | null>(initialAuth?.user ?? null);
  const [loading, setLoading] = useState(initialAuth ? false : true);

  const refreshAuthState = useCallback(async () => {
    setLoading(true);
    const payload = await fetchSessionPayload();
    setUser(payload.user);
    setLoading(false);
    return payload;
  }, []);

  useEffect(() => {
    const refresh = () => {
      void refreshAuthState();
    };
    const requestIdle = window.requestIdleCallback?.bind(window);
    const cancelIdle = window.cancelIdleCallback?.bind(window);

    if (requestIdle && cancelIdle) {
      const idleId = requestIdle(refresh, {
        timeout: AUTH_REFRESH_TIMEOUT_MS,
      });
      return () => cancelIdle(idleId);
    }

    const timeoutId = globalThis.setTimeout(refresh, AUTH_REFRESH_TIMEOUT_MS);
    return () => globalThis.clearTimeout(timeoutId);
  }, [refreshAuthState]);

  const getAuth = useCallback(
    async ({ ensureSignedIn = false }: { ensureSignedIn?: boolean } = {}) => {
      const payload = await refreshAuthState();

      if (ensureSignedIn && !payload.user && typeof window !== "undefined") {
        const returnTo = `${window.location.pathname}${window.location.search}` || "/";
        window.location.assign(getAuthRouteHref("sign-in", returnTo));
      }

      return payload;
    },
    [refreshAuthState],
  );

  const signOut = useCallback(async ({ returnTo }: { returnTo?: string } = {}) => {
    if (typeof window === "undefined") {
      return;
    }

    const fallbackReturnTo = `${window.location.pathname}${window.location.search}` || "/";
    window.location.assign(getLogoutRouteHref(returnTo ?? fallbackReturnTo));
  }, []);

  const appAuthValue = useMemo<AppAuthState>(
    () => ({
      authAvailable: true,
      loading,
      cloudSyncLoading: false,
      cloudSyncReady: false,
      user,
      getAuth,
      signOut,
    }),
    [getAuth, loading, signOut, user],
  );
  const convexClient = useMemo(() => (user ? getConvexClient() : null), [user]);

  return (
    <AppAuthContext.Provider value={appAuthValue}>
      {convexClient ? (
        <ConvexProviderWithAuth client={convexClient} useAuth={useAuthFromSessionForConvex}>
          <ConvexBridgeProvider>{children}</ConvexBridgeProvider>
        </ConvexProviderWithAuth>
      ) : (
        <LocalBridgeProvider>{children}</LocalBridgeProvider>
      )}
    </AppAuthContext.Provider>
  );
}

export function useAppAuth(): AppAuthState {
  const context = useAuthContextValue();
  const { backendLoading, backendAuthenticated } = useContext(ConvexBridgeContext);
  const cloudSyncLoading = Boolean(context.user) && backendLoading;
  const cloudSyncReady = Boolean(context.user) && backendAuthenticated;

  return {
    ...context,
    cloudSyncLoading,
    cloudSyncReady,
  };
}
