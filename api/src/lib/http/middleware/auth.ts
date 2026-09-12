import type { Context, Next } from "hono";
import { decodeAccessToken } from "@/lib/utils/jwt";
import { AuthenticationError } from "@/lib/errors/domain";
import { authMode } from "@/lib/auth/better-auth";
import {
  findUserBySessionToken,
  readSessionCookie,
} from "@/lib/auth/session";

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
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : undefined;

  const betterAuthActive = authMode === "better-auth";

  if (!bearerToken && !betterAuthActive) {
    return unauthorized(c, new AuthenticationError("Missing authorization header"));
  }

  if (betterAuthActive) {
    const sessionToken = bearerToken ?? readSessionCookie(c.req.header("cookie"));

    if (!sessionToken) {
      return unauthorized(c, new AuthenticationError("Missing authorization header"));
    }

    const sessionUser = await findUserBySessionToken(sessionToken);
    if (sessionUser) {
      c.set("user", sessionUser);
      return next();
    }

    if (!bearerToken) {
      return unauthorized(c, new AuthenticationError("Invalid session"));
    }
  }

  if (!bearerToken) {
    return unauthorized(c, new AuthenticationError("Missing authorization header"));
  }

  const result = await decodeAccessToken(bearerToken);

  return result.match(
    (user) => {
      c.set("user", user);
      return next();
    },
    (error) => unauthorized(c, error),
  );
};
