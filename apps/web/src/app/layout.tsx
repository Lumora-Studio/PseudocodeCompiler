import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ClerkProvider } from "@/lib/auth-components";
import "./globals.css";
import { canIndexSite, getSiteOrigin, pageMetadata, siteDescription, siteName } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata("/", "Online pseudocode compiler and flowchart editor", siteDescription),
  metadataBase: getSiteOrigin() ? new URL(getSiteOrigin()!) : undefined,
  applicationName: siteName,
  robots: {
    index: canIndexSite(),
    follow: true,
    googleBot: { index: canIndexSite(), follow: true, "max-image-preview": "large" },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=2" },
      { url: "/icon.png?v=2", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico?v=2" }],
    apple: [{ url: "/icon.png?v=2" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeBootScript = `(() => {
    try {
      const stored = window.localStorage.getItem("igcse-theme-mode");
      const mode = stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
      const resolved = mode === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : mode;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    } catch {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.colorScheme = "dark";
    }
  })();`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="antialiased">
        <ClerkProvider>{children}</ClerkProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
