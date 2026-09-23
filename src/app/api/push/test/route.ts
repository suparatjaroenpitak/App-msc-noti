import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser, assertSameOrigin, ensureUserRateLimit } from "@/lib/api/handler";
import { sendTestNotification } from "@/lib/notifications/send";
import { isPushConfigured } from "@/lib/push/web-push";
import { fail } from "@/lib/api/response";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    ensureUserRateLimit(user.id, "push-test", 10, 3600);

    if (!isPushConfigured()) {
      return fail(503, "INTERNAL_ERROR", "Push notifications are not configured (VAPID keys missing)");
    }

    const body = (await req.json().catch(() => ({}))) as { deviceName?: string };
    const result = await sendTestNotification(user.id, body?.deviceName);
    return ok(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
