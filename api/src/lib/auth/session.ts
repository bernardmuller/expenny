import type { Context } from "hono";
import { setSignedCookie } from "hono/cookie";
import { betterAuthInstance, betterAuthSecret } from "@/lib/auth/better-auth";

// Singleton promise — resolved once at first call
let _ctx: Awaited<typeof betterAuthInstance.$context> | null = null;

const getBetterAuthCtx = async () => {
  if (!_ctx) {
    _ctx = await betterAuthInstance.$context;
  }
  return _ctx;
};

/**
 * Create a session via better-auth's internal adapter.
 * The token it generates is stored in the DB and later looked up by
 * better-auth's own `getSession`, which also validates the signed cookie.
 */
export const createBetterAuthSession = async (
  userId: string,
  request?: Request,
): Promise<{ token: string; expiresAt: Date }> => {
  const ctx = await getBetterAuthCtx();
  // internalAdapter.createSession expects a hook context, not a bare request:
  // it reads `ctx2.context.options` when resolving the client IP and throws
  // `Cannot read properties of undefined (reading 'options')` without it.
  const session = await ctx.internalAdapter.createSession(
    userId,
    { context: ctx, ...(request ? { request } : {}) } as Parameters<
      typeof ctx.internalAdapter.createSession
    >[1],
  );
  return { token: session.token, expiresAt: session.expiresAt };
};

/**
 * Set the better-auth signed session cookie on the Hono response.
 * Cookie name is derived from authCookies config (e.g. `expenny.session_token`).
 */
export const setSessionCookie = async (c: Context, token: string) => {
  const ctx = await getBetterAuthCtx();
  const { name, options } = ctx.authCookies.sessionToken;
  await setSignedCookie(c, name, token, betterAuthSecret, {
    ...options,
    // `sameSite` type mismatch between hono and better-auth — cast explicitly
    sameSite: options.sameSite as "lax" | "strict" | "none" | undefined,
  });
};
