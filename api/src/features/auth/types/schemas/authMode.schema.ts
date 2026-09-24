import { z } from "zod";

export const authModeSchema = z.object({
  google: z.boolean(),
});
