import jwt from "jsonwebtoken";
import { AppResult } from "@/lib/result";
import { AuthenticationError } from "@/lib/errors/domain";
import { ResultAsync } from "neverthrow";

const getJwtSecret = (): string => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not defined in environment variables");
  }
  return secret;
};

export const generateVerificationToken = (
  userId: string,
  verificationId: string,
): AppResult<string, AuthenticationError> =>
  ResultAsync.fromPromise(
    (async () => {
      const payload = { userId, verificationId };
      const secret = getJwtSecret();
      return jwt.sign(payload, secret, { expiresIn: "15m" });
    })(),
    (error) => new AuthenticationError(`Token generation failed: ${String(error)}`),
  );
