// Paleta e tokens do FisioPlay para estilo imperativo (navegação, StatusBar,
// Reanimated). Mantida em sincronia com tailwind.config.js (mesmos hex).
export const colors = {
  bg: "#0B1020",
  surface: "#151B2E",
  card: "#1C2440",
  primary: "#6C5CE7",
  primaryDark: "#5A4BD1",
  accent: "#00D2A8",
  success: "#22C55E",
  successDeep: "#15803D",
  error: "#FF5A5F",
  warning: "#FBBF24",
  ink: "#F5F7FF",
  inkSoft: "#D4DAEC",
  muted: "#8A93AD",
} as const;

export const radius = {
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export type ColorToken = keyof typeof colors;
