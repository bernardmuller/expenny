import z from "zod";
import { userSelectSchema } from "./user.schema";

export const registerVerifyResponseSchema = z.object({
  user: userSelectSchema,
  accessToken: z.jwt().or(z.string().min(1)),
  refreshToken: z.jwt().or(z.string().min(1)),
});
