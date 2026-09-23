import { z } from "zod";

// ---------- Auth ----------
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Invalid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-zA-Z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required").max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-zA-Z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-zA-Z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

// ---------- Watchlist ----------
export const addToWatchlistSchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9.\-]+$/, "Invalid symbol format"),
});

export const reorderWatchlistSchema = z.object({
  items: z.array(z.string().min(1)).min(1).max(200),
});

// ---------- Alerts ----------
export const alertTypeSchema = z.enum(["ENTRY", "EXIT", "CUSTOM"]);
export const alertConditionSchema = z.enum(["ABOVE_OR_EQUAL", "BELOW_OR_EQUAL"]);

export const createAlertSchema = z.object({
  assetId: z.string().min(1),
  name: z.string().trim().min(1, "Alert name is required").max(100),
  type: alertTypeSchema,
  condition: alertConditionSchema,
  targetPrice: z.coerce.number().positive("Target price must be positive").max(1_000_000),
  oneTime: z.boolean().default(false),
  cooldownMinutes: z.coerce.number().int().min(0).max(10080).default(60),
  notificationMessage: z.string().trim().max(500).optional().nullable(),
  soundId: z.string().min(1).optional().nullable(),
  enabled: z.boolean().default(true),
});

export const updateAlertSchema = createAlertSchema.partial().omit({ assetId: true });

export const alertActionSchema = z.object({
  action: z.enum(["enable", "disable", "duplicate", "pause", "resume"]),
});

// ---------- Push ----------
export const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
  deviceName: z.string().trim().max(100).optional(),
  userAgent: z.string().max(255).optional(),
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

// ---------- Notification preferences ----------
export const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  entryEnabled: z.boolean().optional(),
  exitEnabled: z.boolean().optional(),
  customEnabled: z.boolean().optional(),
  defaultSoundId: z.string().min(1).nullable().optional(),
  volume: z.number().min(0).max(1).optional(),
});

export const notificationPreferencesSchemaFull = z.object({
  pushEnabled: z.boolean(),
  entryEnabled: z.boolean(),
  exitEnabled: z.boolean(),
  customEnabled: z.boolean(),
  defaultSoundId: z.string().min(1).nullable(),
  volume: z.number().min(0).max(1),
});

// ---------- Notification sounds ----------
export const SOUND_MIME_ALLOWLIST = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
] as const;

export const renameSoundSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

// ---------- System ----------
export const cronRunSchema = z.object({}).partial();
