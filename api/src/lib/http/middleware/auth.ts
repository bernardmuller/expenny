import type { Context, Next } from "hono";
import { AuthenticationError } from "@/lib/errors/domain";
import { betterAuthInstance } from "@/lib/auth/better-auth";

const unauthorized = (c: Context, error: AuthenticationError) =>
  c.json(
    {
      code: error.code,
      error: error.name,
      message: error.message,
    },
    401,
  );

export const authMiddleware = async (c: Context, next: Next) => {
  const headers = c.req.raw.headers;

  // MCP-issued OAuth tokens deliberately do NOT authenticate here.
  //
  // The only scopes the OIDC provider advertises are identity ones — openid,
  // profile, email, offline_access — so that is all a user is shown, and all
  // they agree to, on the consent screen. Accepting those tokens here would
  // hand every client that asked for "your name and email" full read/write
  // over budgets, transactions and chats.
  //
  // They authenticate exactly one endpoint, /auth/mcp/userinfo, which reads
  // them via getValidMcpToken and returns identity claims only. Before letting
  // an MCP token reach app data, add a scope for it, advertise it in
  // oidcConfig.scopes, surface it on the consent screen, and check it here.

  // Web session cookie (OTP or Google sign-in).
  const session = await betterAuthInstance.api.getSession({ headers });
  if (session?.user) {
    c.set("user", {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });
    return next();
  }

  return unauthorized(c, new AuthenticationError("Authentication required"));
};
