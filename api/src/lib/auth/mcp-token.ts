import { betterAuthInstance } from "@/lib/auth/better-auth";

export const getValidMcpToken = async (headers: Headers) => {
  const token = await betterAuthInstance.api.getMcpSession({ headers });
  if (!token?.userId) {
    return null;
  }

  const expiresAt = new Date(token.accessTokenExpiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return token;
};
