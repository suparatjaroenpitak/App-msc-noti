import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";
import { z } from "zod";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  suggestOnCreate: z.boolean().optional(),
  analyzeOnTrigger: z.boolean().optional(),
  lookbackMinutes: z.coerce.number().int().min(60).max(4320).optional(),
  minSamples: z.coerce.number().int().min(5).max(120).optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const settings = await prisma.analysisSettings.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    return ok({ settings });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const input = updateSchema.parse(await req.json());

    const settings = await prisma.analysisSettings.upsert({
      where: { userId: user.id },
      update: input,
      create: {
        userId: user.id,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.suggestOnCreate !== undefined ? { suggestOnCreate: input.suggestOnCreate } : {}),
        ...(input.analyzeOnTrigger !== undefined ? { analyzeOnTrigger: input.analyzeOnTrigger } : {}),
        ...(input.lookbackMinutes !== undefined ? { lookbackMinutes: input.lookbackMinutes, } : {}),
        ...(input.minSamples !== undefined ? { minSamples: input.minSamples } : {}),
      },
    });
    return ok({ settings });
  } catch (err) {
    return toErrorResponse(err);
  }
}
