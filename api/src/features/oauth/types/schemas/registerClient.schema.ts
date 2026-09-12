import { z } from "zod";

export const oauthGrantTypes = [
  "authorization_code",
  "client_credentials",
  "refresh_token",
] as const;

export const registerClientSchema = z.object({
  client_name: z.string().min(1).max(200),
  client_uri: z.string().url().optional(),
  redirect_uris: z.array(z.string().url()).optional(),
  grant_types: z.array(z.enum(oauthGrantTypes)).optional(),
  token_endpoint_auth_method: z
    .enum(["client_secret_basic", "client_secret_post"])
    .optional(),
  scope: z.string().optional(),
});

export const registerClientResponseSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
  client_id_issued_at: z.number().int().nonnegative(),
  client_secret_expires_at: z.number().int().nonnegative(),
  client_name: z.string(),
  redirect_uris: z.array(z.string()).optional(),
  grant_types: z.array(z.enum(oauthGrantTypes)),
  token_endpoint_auth_method: z.string(),
  scope: z.string().optional(),
});

export type RegisterClientParams = z.infer<typeof registerClientSchema>;