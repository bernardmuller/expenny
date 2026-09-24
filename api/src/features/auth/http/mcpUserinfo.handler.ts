import type { Context } from "hono";
import { betterAuthInstance } from "@/lib/auth/better-auth";

export const mcpUserinfoHandler = async (c: Context) => {
  const headers = c.req.raw.headers;

  // Same introspection the API's own auth middleware performs for MCP callers.
  const token = await betterAuthInstance.api.getMcpSession({ headers });
  if (!token?.userId) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const ctx = await betterAuthInstance.$context;
  const user = await ctx.internalAdapter.findUserById(token.userId);
  if (!user) {
    return c.json({ error: "invalid_token" }, 401);
  }

  return c.json(
    {
      sub: user.id,
      email: user.email,
      email_verified: user.emailVerified,
      name: user.name,
    },
    200,
  );
};
