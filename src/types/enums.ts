// String-literal types แทน Prisma enum (SQLite ไม่รองรับ enum) — ค่าตรงกับที่
// Zod schemas บังคับก่อนเขียนลง DB และตรงกับคอลัมน์ String ใน schema.prisma
// ที่มาของค่า: prisma/schema.prisma (comment ของแต่ละคอลัมน์)

export type AssetType = "STOCK" | "ETF";
export type AlertType = "ENTRY" | "EXIT" | "CUSTOM";
export type AlertCondition = "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
export type AlertEventStatus = "TRIGGERED" | "FAILED";
export type NotificationLogStatus = "SENT" | "FAILED";
export type AnalysisKind = "ON_TRIGGER" | "SUGGEST_PRICE";
export type AnalysisVerdict = "BUY" | "WAIT" | "AVOID";
