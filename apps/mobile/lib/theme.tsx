import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform, StyleSheet, useColorScheme } from "react-native";

export type ThemeMode = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

export interface ThemeColors {
  background: string;
  sidebarPanel: string;
  chrome: string;
  panel: string;
  panelRaised: string;
  panelStrong: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSoft: string;
  success: string;
  danger: string;
  warning: string;
  caution: string;
  syntaxKeyword: string;
  syntaxIdentifier: string;
  syntaxType: string;
  syntaxString: string;
  syntaxNumber: string;
  syntaxRoutine: string;
  syntaxPlain: string;
  lineNumber: string;
  hover: string;
  shadow: string;
  overlay: string;
  selectionStrong: string;
  terminalIndicator: "white" | "black";
  inputKeyboardAppearance: "dark" | "light";
  bg: string;
  sidebar: string;
  titlebar: string;
  surface: string;
  surface2: string;
  surface3: string;
  separator: string;
  text: string;
  text2: string;
  text3: string;
  green: string;
  red: string;
  orange: string;
  yellow: string;
  selected: string;
}

const STORAGE_KEY = "igcse-theme-mode";

const monoFamily = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

const darkColors: ThemeColors = {
  background: "#1C1C1E",
  sidebarPanel: "#262628",
  chrome: "#323234",
  panel: "#2C2C2E",
  panelRaised: "#3A3A3C",
  panelStrong: "#48484A",
  border: "#38383A",
  textPrimary: "#FFFFFF",
  textSecondary: "#98989D",
  textTertiary: "#636366",
  accent: "#0A84FF",
  accentSoft: "rgba(10, 132, 255, 0.19)",
  success: "#30D158",
  danger: "#FF453A",
  warning: "#FF9F0A",
  caution: "#FFD60A",
  syntaxKeyword: "#FC5FA3",
  syntaxIdentifier: "#67B7A4",
  syntaxType: "#5DD8FF",
  syntaxString: "#FC6A5D",
  syntaxNumber: "#D0BF69",
  syntaxRoutine: "#A167E6",
  syntaxPlain: "#E5E5EA",
  lineNumber: "#48484A",
  hover: "rgba(255, 255, 255, 0.04)",
  shadow: "rgba(0, 0, 0, 0.4)",
  overlay: "rgba(0, 0, 0, 0.6)",
  selectionStrong: "rgba(10, 132, 255, 0.28)",
  terminalIndicator: "white",
  inputKeyboardAppearance: "dark",
  bg: "#1C1C1E",
  sidebar: "#262628",
  titlebar: "#323234",
  surface: "#2C2C2E",
  surface2: "#3A3A3C",
  surface3: "#48484A",
  separator: "#38383A",
  text: "#FFFFFF",
  text2: "#98989D",
  text3: "#636366",
  green: "#30D158",
  red: "#FF453A",
  orange: "#FF9F0A",
  yellow: "#FFD60A",
  selected: "rgba(10, 132, 255, 0.19)",
};

const lightColors: ThemeColors = {
  background: "#FFFFFF",
  sidebarPanel: "#FAFAFA",
  chrome: "#FFFFFF",
  panel: "#FFFFFF",
  panelRaised: "#F5F5F5",
  panelStrong: "#EDEDED",
  border: "#E5E5E5",
  textPrimary: "#111111",
  textSecondary: "#4B5563",
  textTertiary: "#9CA3AF",
  accent: "#0B6E4F",
  accentSoft: "rgba(11, 110, 79, 0.14)",
  success: "#0B8F55",
  danger: "#C03B2B",
  warning: "#B45309",
  caution: "#CA8A04",
  syntaxKeyword: "#9B2D63",
  syntaxIdentifier: "#2D7A6D",
  syntaxType: "#0F7A94",
  syntaxString: "#B45438",
  syntaxNumber: "#8D6A12",
  syntaxRoutine: "#7856B3",
  syntaxPlain: "#111111",
  lineNumber: "#CFCFCF",
  hover: "rgba(17, 17, 17, 0.04)",
  shadow: "rgba(17, 17, 17, 0.08)",
  overlay: "rgba(17, 17, 17, 0.16)",
  selectionStrong: "rgba(11, 110, 79, 0.22)",
  terminalIndicator: "black",
  inputKeyboardAppearance: "light",
  bg: "#FFFFFF",
  sidebar: "#FAFAFA",
  titlebar: "#FFFFFF",
  surface: "#FFFFFF",
  surface2: "#F5F5F5",
  surface3: "#EDEDED",
  separator: "#E5E5E5",
  text: "#111111",
  text2: "#4B5563",
  text3: "#9CA3AF",
  green: "#0B8F55",
  red: "#C03B2B",
  orange: "#B45309",
  yellow: "#CA8A04",
  selected: "rgba(11, 110, 79, 0.14)",
};

export const fonts = {
  sans: Platform.select({
    ios: "System",
    android: "sans-serif",
    default: "sans-serif",
  }),
  mono: monoFamily,
} as const;

export const radii = {
  screen: 18,
  section: 16,
  button: 16,
  compactButton: 14,
  row: 8,
  pill: 26,
} as const;

export const PHONE_TOP_BAR_HEIGHT = 48;
export const PHONE_TAB_BAR_HEIGHT = 83;
export const TABLET_TOP_BAR_HEIGHT = 52;
export const TABLET_SIDEBAR_WIDTH = 280;
export const TABLET_SIDEBAR_HANDLE_WIDTH = 20;
export const TABLET_BREADCRUMB_HEIGHT = 32;
export const TABLET_OUTPUT_HEIGHT = 140;
export const COLLAPSED_OUTPUT_HEIGHT = 36;

export const dimensions = {
  phoneTopBarHeight: PHONE_TOP_BAR_HEIGHT,
  phoneTabBarHeight: PHONE_TAB_BAR_HEIGHT,
  tabletTopBarHeight: TABLET_TOP_BAR_HEIGHT,
  tabletSidebarWidth: TABLET_SIDEBAR_WIDTH,
  tabletSidebarHandleWidth: TABLET_SIDEBAR_HANDLE_WIDTH,
  tabletBreadcrumbHeight: TABLET_BREADCRUMB_HEIGHT,
  tabletOutputHeight: TABLET_OUTPUT_HEIGHT,
  collapsedOutputHeight: COLLAPSED_OUTPUT_HEIGHT,
} as const;

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme {
  return mode === "system" ? systemTheme : mode;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === "system" || stored === "dark" || stored === "light") {
          setMode(stored);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => undefined);
  }, [mode]);

  const resolvedTheme = resolveTheme(mode, systemScheme === "light" ? "light" : "dark");
  const colors = resolvedTheme === "dark" ? darkColors : lightColors;

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      colors,
      isDark: resolvedTheme === "dark",
      setMode,
    }),
    [colors, mode, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useAppTheme must be used inside ThemeProvider.");
  }
  return value;
}

export function useThemedStyles<T>(factory: (theme: ThemeContextValue) => T): T {
  const theme = useAppTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

export const colors = darkColors;

export function createThemedStyleSheet<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (theme: ThemeContextValue) => T,
): (theme: ThemeContextValue) => T {
  return (theme) => StyleSheet.create(factory(theme));
}
