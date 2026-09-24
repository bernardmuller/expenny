import type { Context } from "hono";
import env from "@/env";

export const authModeHandler = async (c: Context) => {
  return c.json(
    {
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    },
    200,
  );
};
