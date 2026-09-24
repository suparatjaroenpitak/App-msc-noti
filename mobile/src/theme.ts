/** Shared design tokens — mirrors the web PWA look (dark + emerald). */
export const colors = {
  bg: "#0f1117",
  card: "#171a23",
  cardAlt: "#1e2230",
  border: "#2a3040",
  text: "#f4f5f7",
  textMuted: "#98a2b3",
  textFaint: "#6b7280",
  primary: "#059669",
  primaryDark: "#047857",
  primarySoft: "#0d3b2e",
  danger: "#ef4444",
  dangerSoft: "#3b1a1a",
  warning: "#f59e0b",
  success: "#10b981",
  info: "#3b82f6",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
