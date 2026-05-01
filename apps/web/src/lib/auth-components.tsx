"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  ClerkProvider as ClerkProviderBase,
  Show as ClerkShow,
  SignInButton as ClerkSignInButton,
  SignUpButton as ClerkSignUpButton,
  UserButton as ClerkUserButton,
  useAuth as useClerkAuth,
} from "@clerk/nextjs";
import { getClientAppPlatform, platformUsesCloudSaving } from "@/lib/platform";

const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function isCloudAuthConfigured() {
  return Boolean(clerkPublishableKey);
}

function cloudAuthRequired() {
  if (typeof window === "undefined") {
    return false;
  }

  return platformUsesCloudSaving(getClientAppPlatform());
}

export function ClerkProvider({ children }: { children: ReactNode }) {
  if (!cloudAuthRequired() || !isCloudAuthConfigured()) {
    return <>{children}</>;
  }

  return (
    <ClerkProviderBase
      publishableKey={clerkPublishableKey}
      appearance={{
        elements: {
          modalBackdrop: {
            alignItems: "center",
            justifyContent: "center",
          },
          modalContent: {
            margin: "auto",
          },
          modalCloseButton: {
            backgroundColor: "transparent",
            border: "0",
            boxShadow: "none",
            outline: "none",
            "&:focus": {
              boxShadow: "none",
              outline: "none",
            },
            "&:focus-visible": {
              boxShadow: "none",
              outline: "none",
            },
          },
        },
      }}
    >
      {children}
    </ClerkProviderBase>
  );
}

export function Show({ children, when }: ComponentProps<typeof ClerkShow>) {
  if (!cloudAuthRequired() || !isCloudAuthConfigured()) {
    return when === "signed-out" ? <>{children}</> : null;
  }

  return <ClerkShow when={when}>{children}</ClerkShow>;
}

export function SignInButton({
  children,
  ...props
}: ComponentProps<typeof ClerkSignInButton>) {
  if (!cloudAuthRequired() || !isCloudAuthConfigured()) {
    return <>{children}</>;
  }

  return <ClerkSignInButton {...props}>{children}</ClerkSignInButton>;
}

export function SignUpButton({
  children,
  ...props
}: ComponentProps<typeof ClerkSignUpButton>) {
  if (!cloudAuthRequired() || !isCloudAuthConfigured()) {
    return <>{children}</>;
  }

  return <ClerkSignUpButton {...props}>{children}</ClerkSignUpButton>;
}

export function UserButton(props: ComponentProps<typeof ClerkUserButton>) {
  if (!cloudAuthRequired() || !isCloudAuthConfigured()) {
    return null;
  }

  return <ClerkUserButton {...props} />;
}

export function useAuth() {
  if (!cloudAuthRequired() || !isCloudAuthConfigured()) {
    return {
      isLoaded: true,
      isSignedIn: false,
      userId: null,
    };
  }

  // Clerk's hook is only reachable in configured builds, where AppAuthProvider
  // supplies the matching provider for this stable runtime branch.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useClerkAuth();
}
