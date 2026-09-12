import type { Context } from "hono";
import { authMode } from "@/lib/auth/better-auth";
import env from "@/env";

export const authModeHandler = async (c: Context) => {
  return c.json(
    {
      mode: authMode,
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
    200,
  );
};