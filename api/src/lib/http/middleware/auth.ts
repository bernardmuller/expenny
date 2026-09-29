import type { Context, Next } from "hono";
import { AuthenticationError } from "@/lib/errors/domain";
import { betterAuthInstance } from "@/lib/auth/better-auth";

const unauthorized = (c: Context, error: AuthenticationError) =>
  c.json(
    {
      code: error.code,
      error: error.name,
      message: error.message,
    },
    401,
  );

export const authMiddleware = async (c: Context, next: Next) => {
  const headers = c.req.raw.headers;

  const session = await betterAuthInstance.api.getSession({ headers });
  if (session?.user) {
    c.set("user", {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });
    return next();
  }

  return unauthorized(c, new AuthenticationError("Authentication required"));
};
