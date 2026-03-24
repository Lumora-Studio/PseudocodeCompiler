import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyResolvedTheme,
  getSystemTheme,
  isThemeMode,
  loadThemeMode,
  resolveTheme,
  saveThemeMode,
} from "@/lib/theme";

const localStore = new Map<string, string>();

describe("theme helpers", () => {
  beforeEach(() => {
    localStore.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => localStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
          localStore.set(key, value);
        },
        removeItem: (key: string) => {
          localStore.delete(key);
        },
      },
    });
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  it("validates known theme modes", () => {
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("sepia")).toBe(false);
  });

  it("loads and saves the persisted theme mode", () => {
    expect(loadThemeMode()).toBe("system");
    saveThemeMode("light");
    expect(loadThemeMode()).toBe("light");
  });

  it("resolves system mode using the current media query", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    expect(getSystemTheme()).toBe("dark");
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("light", "dark")).toBe("light");
  });

  it("applies the resolved theme to the document root", () => {
    applyResolvedTheme("light");

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});
