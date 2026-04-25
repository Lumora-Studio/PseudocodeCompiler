import {
  AppAuthProvider as LocalAppAuthProvider,
  useAppAuth as useLocalAppAuth,
} from "@/lib/auth/electron";
import {
  AppAuthProvider as WebAppAuthProvider,
  useAppAuth as useWebAppAuth,
} from "@/lib/auth/web";
import { isLocalAppRuntime } from "@/lib/app-runtime";

export const AppAuthProvider = isLocalAppRuntime() ? LocalAppAuthProvider : WebAppAuthProvider;
export const useAppAuth = isLocalAppRuntime() ? useLocalAppAuth : useWebAppAuth;

export type { AppAuthInitialState, AppAuthState, AppAuthUser } from "@/lib/auth/web";
