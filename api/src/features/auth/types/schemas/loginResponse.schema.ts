import z from "zod";

export const loginResponseSchema = z.object({
  accessToken: z.jwt().or(z.string().min(1)),
  refreshToken: z.jwt().or(z.string().min(1)),
});
