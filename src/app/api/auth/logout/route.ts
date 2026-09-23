import { ok, toErrorResponse } from "@/lib/api/response";
import { destroySession, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/api/handler";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await destroySession(req);
    const res = ok({ loggedOut: true });
    res.cookies.set(sessionCookieName(), "", sessionCookieOptions(0));
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
