import type { Context } from "hono";
import { betterAuthUrl } from "@/lib/auth/better-auth";

export const oauthMetadataHandler = async (c: Context) => {
  const issuer = betterAuthUrl;

  return c.json(
    {
      issuer,
      token_endpoint: `${issuer}/auth/oauth/token`,
      registration_endpoint: `${issuer}/auth/oauth/register`,
      response_types_supported: [],
      grant_types_supported: ["client_credentials"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
      ],
      scopes_supported: ["openid", "profile", "email"],
    },
    200,
  );
};