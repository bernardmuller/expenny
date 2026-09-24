import { z } from "zod";

export const mcpUserinfoSchema = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  name: z.string(),
});
