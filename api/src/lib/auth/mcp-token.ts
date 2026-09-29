import { betterAuthInstance } from "@/lib/auth/better-auth";

/**
 * Resolve an MCP-issued bearer token to its access-token record, or null.
 *
 * better-auth's `getMcpSession` looks the token up by value and returns the row
 * as-is — it never reads `accessTokenExpiresAt`. On its own that makes every
 * token immortal, and `accessTokenExpiresIn` decorative. better-auth's own
 * `/oauth2/userinfo` rejects expired tokens, so every path that authenticates
 * through `getMcpSession` has to apply the same rule.
 */
export const getValidMcpToken = async (headers: Headers) => {
  const token = await betterAuthInstance.api.getMcpSession({ headers });
  if (!token?.userId) {
    return null;
  }

  // The drizzle adapter hands back a Date; be tolerant of a serialized one.
  const expiresAt = new Date(token.accessTokenExpiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return token;
};
