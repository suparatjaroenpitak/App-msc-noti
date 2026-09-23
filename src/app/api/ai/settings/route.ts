import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";
import { normalizeBaseUrl } from "@/lib/ai/client";
import { z } from "zod";

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  analyzeOnTrigger: z.boolean().optional(),
  suggestOnCreate: z.boolean().optional(),
  baseUrl: z.string().trim().max(200).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  timeoutSeconds: z.coerce.number().int().min(15).max(300).optional(),
  temperature: z.number().min(0).max(1).optional(),
});

function maskBaseUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.hostname.split(".");
    if (parts.length <= 2) return u.hostname;
    return `${parts[0]?.slice(0, 6)}….${parts.slice(-2).join(".")}`;
  } catch {
    return "invalid";
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const settings = await prisma.aiSettings.findUnique({ where: { userId: user.id } });
    if (!settings) return ok({ settings: null });
    return ok({ settings: { ...settings, baseUrl: maskBaseUrl(settings.baseUrl) } });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const input = updateSchema.parse(await req.json());

    const data: {
      enabled?: boolean;
      analyzeOnTrigger?: boolean;
      suggestOnCreate?: boolean;
      baseUrl?: string;
      model?: string;
      timeoutSeconds?: number;
      temperature?: number;
    } = {};

    if (input.baseUrl !== undefined) data.baseUrl = normalizeBaseUrl(input.baseUrl);
    if (input.model !== undefined) data.model = input.model;
    if (input.timeoutSeconds !== undefined) data.timeoutSeconds = input.timeoutSeconds;
    if (input.temperature !== undefined) data.temperature = input.temperature;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.analyzeOnTrigger !== undefined) data.analyzeOnTrigger = input.analyzeOnTrigger;
    if (input.suggestOnCreate !== undefined) data.suggestOnCreate = input.suggestOnCreate;

    const settings = await prisma.aiSettings.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        userId: user.id,
        enabled: data.enabled ?? false,
        analyzeOnTrigger: data.analyzeOnTrigger ?? false,
        suggestOnCreate: data.suggestOnCreate ?? true,
        baseUrl: data.baseUrl ?? "",
        model: data.model ?? "llama3.1:8b",
        timeoutSeconds: data.timeoutSeconds ?? 60,
        temperature: data.temperature ?? 0.2,
      },
    });

    return ok({ settings });
  } catch (err) {
    return toErrorResponse(err);
  }
}
