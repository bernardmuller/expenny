import type { Context } from "hono";
import { setSignedCookie } from "hono/cookie";
import { betterAuthInstance, betterAuthSecret } from "@/lib/auth/better-auth";

let _ctx: Awaited<typeof betterAuthInstance.$context> | null = null;

const getBetterAuthCtx = async () => {
  if (!_ctx) {
    _ctx = await betterAuthInstance.$context;
  }
  return _ctx;
};

export const createBetterAuthSession = async (
  userId: string,
  request?: Request,
): Promise<{ token: string; expiresAt: Date }> => {
  const ctx = await getBetterAuthCtx();
  const session = await ctx.internalAdapter.createSession(
    userId,
    { context: ctx, ...(request ? { request } : {}) } as Parameters<
      typeof ctx.internalAdapter.createSession
    >[1],
  );
  return { token: session.token, expiresAt: session.expiresAt };
};

export const setSessionCookie = async (c: Context, token: string) => {
  const ctx = await getBetterAuthCtx();
  const { name, options } = ctx.authCookies.sessionToken;
  await setSignedCookie(c, name, token, betterAuthSecret, {
    ...options,
    sameSite: options.sameSite as "lax" | "strict" | "none" | undefined,
  });
};
