import { describe, expect, it } from "vitest";
import {
  getAuthRouteHref,
  getLogoutRouteHref,
  normalizeAuthReturnTo,
  resolveAuthBaseUrl,
  resolveAuthRedirectUri,
} from "@/lib/auth/urls";

describe("auth url helpers", () => {
  it("prefers the configured redirect uri on Vercel-host requests", () => {
    const previousRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    const previousProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const previousPublicProjectProductionUrl =
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    try {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
        "https://pseudocode-compiler-web-the1uneeds-projects.vercel.app/callback";
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

      const request = {
        headers: new Headers({
          "x-forwarded-host": "pseudocode-compiler-mckwtb2us-the1uneeds-projects.vercel.app",
          "x-forwarded-proto": "https",
        }),
        nextUrl: new URL("https://pseudocode-compiler-mckwtb2us-the1uneeds-projects.vercel.app/login"),
        url: "https://pseudocode-compiler-mckwtb2us-the1uneeds-projects.vercel.app/login",
      };

      expect(resolveAuthBaseUrl(request)).toBe(
        "https://pseudocode-compiler-web-the1uneeds-projects.vercel.app",
      );
      expect(resolveAuthRedirectUri(request)).toBe(
        "https://pseudocode-compiler-web-the1uneeds-projects.vercel.app/callback",
      );
    } finally {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = previousRedirectUri;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProjectProductionUrl;
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = previousPublicProjectProductionUrl;
    }
  });

  it("uses forwarded host and protocol when resolving the auth base url", () => {
    const previousRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    const previousProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const previousPublicProjectProductionUrl =
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    try {
      delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

      const request = {
        headers: new Headers({
          "x-forwarded-host": "preview.example.com",
          "x-forwarded-proto": "https",
        }),
        nextUrl: new URL("http://internal-host.test/login"),
        url: "http://internal-host.test/login",
      };

      expect(resolveAuthBaseUrl(request)).toBe("https://preview.example.com");
      expect(resolveAuthRedirectUri(request)).toBe("https://preview.example.com/callback");
    } finally {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = previousRedirectUri;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProjectProductionUrl;
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = previousPublicProjectProductionUrl;
    }
  });

  it("ignores a localhost redirect uri on non-local requests", () => {
    const previousRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    const previousProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const previousPublicProjectProductionUrl =
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    try {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = "http://localhost:3000/callback";
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

      const request = {
        headers: new Headers({
          "x-forwarded-host": "pseudocode-compiler-web.vercel.app",
          "x-forwarded-proto": "https",
        }),
        nextUrl: new URL("https://pseudocode-compiler-web.vercel.app/login"),
        url: "https://pseudocode-compiler-web.vercel.app/login",
      };

      expect(resolveAuthBaseUrl(request)).toBe("https://pseudocode-compiler-web.vercel.app");
      expect(resolveAuthRedirectUri(request)).toBe(
        "https://pseudocode-compiler-web.vercel.app/callback",
      );
    } finally {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = previousRedirectUri;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProjectProductionUrl;
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = previousPublicProjectProductionUrl;
    }
  });

  it("uses Vercel's canonical production domain for Vercel deployment hosts", () => {
    const previousRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    const previousProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const previousPublicProjectProductionUrl =
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    try {
      delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "apps.lumorastudio.top";
      delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

      const request = {
        headers: new Headers({
          "x-forwarded-host": "pseudocode-compiler-mckwtb2us-the1uneeds-projects.vercel.app",
          "x-forwarded-proto": "https",
        }),
        nextUrl: new URL("https://pseudocode-compiler-mckwtb2us-the1uneeds-projects.vercel.app/login"),
        url: "https://pseudocode-compiler-mckwtb2us-the1uneeds-projects.vercel.app/login",
      };

      expect(resolveAuthBaseUrl(request)).toBe("https://apps.lumorastudio.top");
      expect(resolveAuthRedirectUri(request)).toBe("https://apps.lumorastudio.top/callback");
    } finally {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = previousRedirectUri;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProjectProductionUrl;
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = previousPublicProjectProductionUrl;
    }
  });

  it("prefers the current custom domain over Vercel's production alias", () => {
    const previousRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    const previousProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const previousPublicProjectProductionUrl =
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    try {
      delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "pseudocode-compiler-web.vercel.app";
      delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

      const request = {
        headers: new Headers({
          "x-forwarded-host": "apps.lumorastudio.top",
          "x-forwarded-proto": "https",
        }),
        nextUrl: new URL("https://apps.lumorastudio.top/login"),
        url: "https://apps.lumorastudio.top/login",
      };

      expect(resolveAuthBaseUrl(request)).toBe("https://apps.lumorastudio.top");
      expect(resolveAuthRedirectUri(request)).toBe("https://apps.lumorastudio.top/callback");
    } finally {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = previousRedirectUri;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProjectProductionUrl;
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = previousPublicProjectProductionUrl;
    }
  });

  it("ignores a configured Vercel-host redirect uri on custom-domain requests", () => {
    const previousRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    const previousProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const previousPublicProjectProductionUrl =
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    try {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI =
        "https://pseudocode-compiler-web.vercel.app/callback";
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "pseudocode-compiler-web.vercel.app";
      delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

      const request = {
        headers: new Headers({
          "x-forwarded-host": "apps.lumorastudio.top",
          "x-forwarded-proto": "https",
        }),
        nextUrl: new URL("https://apps.lumorastudio.top/login"),
        url: "https://apps.lumorastudio.top/login",
      };

      expect(resolveAuthBaseUrl(request)).toBe("https://apps.lumorastudio.top");
      expect(resolveAuthRedirectUri(request)).toBe("https://apps.lumorastudio.top/callback");
    } finally {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = previousRedirectUri;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProjectProductionUrl;
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = previousPublicProjectProductionUrl;
    }
  });

  it("falls back to the request origin when forwarded headers are absent", () => {
    const previousRedirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    const previousProjectProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const previousPublicProjectProductionUrl =
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    try {
      delete process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
      delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

      const request = {
        headers: new Headers(),
        nextUrl: new URL("https://pseudocode-compiler.example.com/signup"),
        url: "https://pseudocode-compiler.example.com/signup",
      };

      expect(resolveAuthBaseUrl(request)).toBe("https://pseudocode-compiler.example.com");
      expect(resolveAuthRedirectUri(request)).toBe("https://pseudocode-compiler.example.com/callback");
    } finally {
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI = previousRedirectUri;
      process.env.VERCEL_PROJECT_PRODUCTION_URL = previousProjectProductionUrl;
      process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL = previousPublicProjectProductionUrl;
    }
  });

  it("normalizes only same-origin return paths", () => {
    expect(normalizeAuthReturnTo("/manual?section=auth")).toBe("/manual?section=auth");
    expect(normalizeAuthReturnTo("https://evil.example.com")).toBeUndefined();
    expect(normalizeAuthReturnTo("//evil.example.com")).toBeUndefined();
    expect(normalizeAuthReturnTo("manual")).toBeUndefined();
  });

  it("builds sign-in and sign-up route hrefs with safe return targets", () => {
    expect(getAuthRouteHref("sign-in", "/manual?section=auth")).toBe(
      "/login?returnTo=%2Fmanual%3Fsection%3Dauth",
    );
    expect(getAuthRouteHref("sign-up", "https://evil.example.com")).toBe(
      "/signup?returnTo=%2F",
    );
  });

  it("builds logout route hrefs with safe return targets", () => {
    expect(getLogoutRouteHref("/manual?section=auth")).toBe(
      "/logout?returnTo=%2Fmanual%3Fsection%3Dauth",
    );
    expect(getLogoutRouteHref("https://evil.example.com")).toBe(
      "/logout?returnTo=%2F",
    );
  });
});
