"use client";

import type { ReactNode } from "react";

interface AuthKitProviderProps {
  children: ReactNode;
}

export function AuthKitProvider({ children }: AuthKitProviderProps) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    user: null,
    loading: false,
    signOut: async () => {},
  };
}
