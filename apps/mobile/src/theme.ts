// Design tokens for the native-feel mobile editor.
// Cinematic dark palette (no gradients, no web-blue links).
// MIT-compatible, written from scratch for OpenCut mobile.

export const palette = {
  background: "#09090b",
  surface: "#131316",
  card: "#1b1b1f",
  cardElevated: "#232329",
  border: "#27272a",
  borderStrong: "#3f3f46",
  text: "#fafafa",
  textSecondary: "#d4d4d8",
  muted: "#a1a1aa",
  faint: "#71717a",
  accent: "#fafafa",
  accentDim: "#27272a",
  danger: "#f87171",
  dangerBorder: "#7f1d1d",
  success: "#34d399",
  warning: "#fbbf24",
  scrim: "rgba(0, 0, 0, 0.62)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const typeScale = {
  caption: 12,
  body: 14,
  bodyLarge: 15,
  title: 17,
  largeTitle: 22,
  display: 28,
} as const;

/** Minimum touch target (Apple HIG / Material both suggest 44-48px). */
export const touchTargetMin = 48;

export const spring = {
  fastMs: 150,
  baseMs: 200,
  slowMs: 320,
  /** iOS-style spring-ish easing, no bounce overflow. */
  easing: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/** Safe-area helpers (viewport-fit=cover is set in index.html). */
export const safe = {
  top: (extra = 8): string =>
    `calc(env(safe-area-inset-top, 0px) + ${extra}px)`,
  bottom: (extra = 8): string =>
    `calc(env(safe-area-inset-bottom, 0px) + ${extra}px)`,
  left: (extra = 12): string =>
    `calc(env(safe-area-inset-left, 0px) + ${extra}px)`,
  right: (extra = 12): string =>
    `calc(env(safe-area-inset-right, 0px) + ${extra}px)`,
} as const;

export const theme = {
  palette,
  spacing,
  radii,
  typeScale,
  touchTargetMin,
  spring,
  safe,
} as const;

export type Theme = typeof theme;
export default theme;
