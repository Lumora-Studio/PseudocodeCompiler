"use client";

import type { ReactNode } from "react";
import type { AppAuthInitialState, AppAuthState } from "./web";

const noopAsync = async (_options?: unknown) => undefined;

export function AppAuthProvider({
  children,
  initialAuth: _initialAuth,
}: {
  children: ReactNode;
  initialAuth?: AppAuthInitialState;
}) {
  return <>{children}</>;
}

export function useAppAuth(): AppAuthState {
  return {
    authAvailable: false,
    loading: false,
    cloudSyncLoading: false,
    cloudSyncReady: true,
    user: null,
    getAuth: noopAsync,
    signOut: noopAsync,
  };
}
