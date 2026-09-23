/* eslint-disable no-console */
// Standalone background worker — deployable separately from Next.js.
// Runs the poll cycle every POLLING_INTERVAL_SECONDS.

const intervalSeconds = (() => {
  const n = Number(process.env.POLLING_INTERVAL_SECONDS ?? "60");
  return Number.isFinite(n) && n >= 10 ? n : 60;
})();

let timer: NodeJS.Timeout | null = null;
let running = false;
let shuttingDown = false;

async function tick(): Promise<void> {
  if (running || shuttingDown) return;
  running = true;
  const startedAt = Date.now();
  try {
    // Lazy import so the worker boots even if the app env is momentarily incomplete.
    const { runPollCycle } = await import("../src/worker/alert-engine");
    const result = await runPollCycle();
    console.log(
      `[worker] cycle ${new Date().toISOString()} — symbols=${result.symbolsPolled} rules=${result.rulesEvaluated} ` +
        `triggered=${result.alertsTriggered} sent=${result.notificationsSent} failed=${result.notificationsFailed} ` +
        `(${Date.now() - startedAt}ms)`,
    );
  } catch (err) {
    console.error("[worker] cycle failed:", err instanceof Error ? err.stack ?? err.message : err);
  } finally {
    running = false;
  }
}

function schedule(): void {
  timer = setInterval(() => {
    void tick();
  }, intervalSeconds * 1000);
}

async function main(): Promise<void> {
  console.log(`[worker] starting — interval=${intervalSeconds}s pid=${process.pid}`);
  // Run once immediately at boot, then on the interval.
  void tick();
  schedule();

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[worker] ${signal} received — graceful shutdown…`);
    if (timer) clearInterval(timer);
    // Wait for the current tick (if any) to finish, bounded.
    const deadline = Date.now() + 10_000;
    while (running && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const { prisma } = await import("../src/lib/db/prisma");
    await prisma.$disconnect();
    console.log("[worker] bye");
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
