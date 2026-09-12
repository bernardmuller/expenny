import type { Context } from "hono";
import { createContext } from "@/lib/db/context";
import { mapErrorToResponse } from "@/lib/http/errorMapper";
import { loginAttempt } from "../services";
import { AuthenticationError } from "@/lib/errors/domain";
import { authMode } from "@/lib/auth/better-auth";
import { buildSessionCookie } from "@/lib/auth/session";

export const loginAttemptHandler = async (c: Context) => {
  const body = await c.req.json<{
    otp: string;
  }>();

  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    const error = new AuthenticationError("Authentication token missing");
    return mapErrorToResponse(error, c);
  }

  if (!authHeader.startsWith("Bearer ")) {
    const error = new AuthenticationError("Invalid authentication token");
    return mapErrorToResponse(error, c);
  }

  const token = authHeader.substring(7);

  if (!token) {
    const error = new AuthenticationError("Invalid authentication token");
    return mapErrorToResponse(error, c);
  }

  const ctx = createContext();
  const result = await loginAttempt({ otp: body.otp, token }, ctx);

  return result.match(
    (tokens) => {
      if (authMode === "better-auth") {
        c.header("set-cookie", buildSessionCookie(tokens.accessToken), {
          append: true,
        });
      }
      return c.json(tokens, 200);
    },
    (error) => mapErrorToResponse(error, c),
  );
};
