import type { Context, Next } from "hono";
import { AuthenticationError } from "@/lib/errors/domain";
import { betterAuthInstance } from "@/lib/auth/better-auth";
import { getValidMcpToken } from "@/lib/auth/mcp-token";

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

  // 1. Try MCP-issued opaque bearer token (from /auth/mcp/* flow).
  //    getValidMcpToken returns an unexpired OAuthAccessToken record, which
  //    carries the userId. We then hydrate the full user via better-auth's
  //    internal adapter.
  const mcpToken = await getValidMcpToken(headers);
  if (mcpToken?.userId) {
    const baCtx = await betterAuthInstance.$context;
    const user = await baCtx.internalAdapter.findUserById(mcpToken.userId);
    if (user) {
      c.set("user", {
        userId: user.id,
        email: user.email,
        name: user.name,
      });
      return next();
    }
  }

  // 2. Try web session cookie (OTP or Google sign-in).
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
