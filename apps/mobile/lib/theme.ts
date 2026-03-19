import { Platform } from "react-native";

const monoFamily = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

export const colors = {
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

  // Backwards-compatible aliases used by existing mobile files.
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
} as const;

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

// Legacy layout exports kept for compatibility with older mobile bundles/imports.
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
