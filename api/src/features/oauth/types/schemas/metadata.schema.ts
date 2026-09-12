import { z } from "zod";

export const oauthMetadataSchema = z.object({
  issuer: z.string(),
  token_endpoint: z.string(),
  registration_endpoint: z.string().optional(),
  response_types_supported: z.array(z.string()),
  grant_types_supported: z.array(z.string()),
  token_endpoint_auth_methods_supported: z.array(z.string()),
  scopes_supported: z.array(z.string()).optional(),
});