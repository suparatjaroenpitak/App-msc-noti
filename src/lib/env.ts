// Central, validated access to environment variables.
// Never import this into client components — it may read server-only secrets.

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

function required(name: string): string {
  const v = optional(name);
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const env = {
  get appUrl(): string {
    return optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
  },
  get authSecret(): string {
    return required("AUTH_SECRET");
  },
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  vapid: {
    get publicKey(): string | undefined {
      return optional("VAPID_PUBLIC_KEY");
    },
    get privateKey(): string | undefined {
      return optional("VAPID_PRIVATE_KEY");
    },
    get subject(): string {
      return optional("VAPID_SUBJECT") ?? "mailto:admin@example.com";
    },
    get configured(): boolean {
      return Boolean(optional("VAPID_PUBLIC_KEY") && optional("VAPID_PRIVATE_KEY"));
    },
  },
  marketData: {
    get provider(): "mock" | "twelvedata" | "alphavantage" | "finnhub" {
      const p = (optional("MARKET_DATA_PROVIDER") ?? "mock").toLowerCase();
      return p === "twelvedata" || p === "alphavantage" || p === "finnhub" ? p : "mock";
    },
  },
  worker: {
    get pollingIntervalSeconds(): number {
      const n = Number(optional("POLLING_INTERVAL_SECONDS") ?? "60");
      return Number.isFinite(n) && n >= 10 ? n : 60;
    },
  },
  sounds: {
    get maxSizeBytes(): number {
      const n = Number(optional("MAX_SOUND_FILE_SIZE_MB") ?? "10");
      return (Number.isFinite(n) && n > 0 ? n : 10) * 1024 * 1024;
    },
    get maxDurationSeconds(): number {
      const n = Number(optional("MAX_SOUND_DURATION_SECONDS") ?? "30");
      return Number.isFinite(n) && n > 0 ? n : 30;
    },
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
