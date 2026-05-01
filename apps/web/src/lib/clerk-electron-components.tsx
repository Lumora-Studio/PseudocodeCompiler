"use client";

import type { ReactNode } from "react";

interface ProviderProps {
  children: ReactNode;
}

interface VisibilityProps {
  children: ReactNode;
  when: "signed-in" | "signed-out";
}

interface ButtonProps {
  children?: ReactNode;
}

export function ClerkProvider({ children }: ProviderProps) {
  return <>{children}</>;
}

export function Show({ children, when }: VisibilityProps) {
  return when === "signed-out" ? <>{children}</> : null;
}

export function SignInButton({ children }: ButtonProps) {
  return <>{children}</>;
}

export function SignUpButton({ children }: ButtonProps) {
  return <>{children}</>;
}

export function UserButton() {
  return null;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: false,
    userId: null,
  };
}

export function isCloudAuthConfigured() {
  return false;
}
