import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { shouldEnableVercelTelemetry } from "@/lib/vercelTelemetry";
import "./globals.css";

const sansFont = localFont({
  src: [
    {
      path: "../../public/fonts/inter-latin.woff2",
      weight: "400 700",
      style: "normal",
    },
    {
      path: "../../public/fonts/inter-latin-ext.woff2",
      weight: "400 700",
      style: "normal",
    },
  ],
  display: "swap",
  preload: true,
  variable: "--font-sans",
});

const monoFont = localFont({
  src: [
    {
      path: "../../public/fonts/fira-code-latin.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "../../public/fonts/fira-code-latin-ext.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "../../public/fonts/fira-code-symbols.woff2",
      weight: "400 600",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Pseudocode Compiler",
  description: "Pseudocode Compiler editor, runtime, and compiler with Python execution.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shouldTrackVercelTelemetry = shouldEnableVercelTelemetry();

  const themeBootScript = `(() => {
    try {
      const stored = window.localStorage.getItem("pseudocode-compiler-theme-mode");
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sansFont.variable} ${monoFont.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="antialiased">
        {children}
        {shouldTrackVercelTelemetry ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
