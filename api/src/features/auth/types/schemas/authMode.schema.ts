import { z } from "zod";

export const authModeSchema = z.object({
  mode: z.enum(["legacy", "better-auth"]),
  google: z.boolean(),
});