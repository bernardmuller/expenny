import { z } from "zod";

export const oauthTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
});

export const oauthErrorSchema = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});