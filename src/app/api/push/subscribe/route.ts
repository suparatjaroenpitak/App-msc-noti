import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";
import { subscribeSchema } from "@/lib/validation/schemas";
import { isPushConfigured } from "@/lib/push/web-push";
import { fail } from "@/lib/api/response";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);

    if (!isPushConfigured()) {
      return fail(503, "INTERNAL_ERROR", "Push notifications are not configured on this server (VAPID keys missing)");
    }

    const { endpoint, keys, deviceName, userAgent } = subscribeSchema.parse(await req.json());

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent?.slice(0, 255) ?? null,
        deviceName: deviceName?.slice(0, 100) ?? null,
        lastUsedAt: new Date(),
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent?.slice(0, 255) ?? null,
        deviceName: deviceName?.slice(0, 100) ?? null,
      },
    });

    return ok({ subscribed: true, id: subscription.id });
  } catch (err) {
    return toErrorResponse(err);
  }
}
