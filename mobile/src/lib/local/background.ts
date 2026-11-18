import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { ensureBackend, runLocalPollCycle } from "./backend";

export const PRICE_POLL_TASK = "stock-alert-price-poll";
const MINIMUM_INTERVAL_SECONDS = 15 * 60;

// This task is intentionally defined at module scope. The OS can start the
// JS runtime without rendering the React tree, so it cannot depend on App.tsx.
TaskManager.defineTask(PRICE_POLL_TASK, async () => {
  try {
    ensureBackend();
    await runLocalPollCycle();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (err) {
    console.warn("[background-price-poll] failed", err);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Register best-effort OS background polling for Android and iOS. */
export async function registerBackgroundPriceTask(): Promise<void> {
  try {
    ensureBackend();
    if (await TaskManager.isTaskRegisteredAsync(PRICE_POLL_TASK)) return;
    await BackgroundTask.registerTaskAsync(PRICE_POLL_TASK, {
      minimumInterval: MINIMUM_INTERVAL_SECONDS,
    });
  } catch (err) {
    // Foreground polling remains available when the OS declines background time.
    console.warn("[background-price-poll] registration failed", err);
  }
}
