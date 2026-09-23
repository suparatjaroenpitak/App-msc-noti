import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/api/handler";
import { isPushConfigured } from "@/lib/push/web-push";
import { env } from "@/lib/env";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, endpoint: true, deviceName: true, userAgent: true, lastUsedAt: true, createdAt: true,
      },
    });

    return ok({
      pushConfigured: isPushConfigured(),
      vapidPublicKey: env.vapid.publicKey ?? null, // public key is safe to expose
      devices: subscriptions.map((s) => ({
        ...s,
        endpoint: s.endpoint.slice(0, 60) + "…", // truncate for display
      })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
