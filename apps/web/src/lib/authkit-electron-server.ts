import type { NextRequest } from "next/server";

export async function withAuth() {
  return {
    accessToken: null,
    user: null,
  };
}

export async function getSignInUrl() {
  return "/";
}

export async function signOut() {}

export function handleAuth() {
  return async () => new Response(null, { status: 404 });
}

export async function authkit() {
  return {
    headers: new Headers(),
  };
}

export function handleAuthkitHeaders(request: NextRequest) {
  return request;
}
