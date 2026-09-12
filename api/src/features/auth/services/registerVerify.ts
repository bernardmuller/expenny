import type { AppContext } from "@/lib/db/context";
import * as UserServices from "@/features/users/services";
import { errAsync } from "neverthrow";
import type { RegisterVerifyParams, RegisterVerifyResponse } from "../types";
import { pinoInstance as logger } from "@/lib/http/middleware/logger";
import { compareOTP } from "@/lib/utils/compareOTP";
import { decodeVerificationToken } from "@/lib/utils/decodeVerificationToken";
import { generateAccessToken, generateRefreshToken } from "@/lib/utils/jwt";
import { authMode } from "@/lib/auth/better-auth";
import { ResultAsync } from "neverthrow";
import { createBetterAuthSession } from "@/lib/auth/session";
import { DatabaseError } from "@/lib/errors/domain";
import * as VerificationServices from "@/features/verifications/services";
import { AppResult } from "@/lib/result";
import { AuthenticationError } from "@/lib/errors/domain";
import * as UserQueries from "@/features/users/queries/index";
import * as UserDomain from "@/features/users/actions";

export const registerVerify = (
  params: RegisterVerifyParams & { token: string },
  ctx: AppContext,
): AppResult<RegisterVerifyResponse> =>
  decodeVerificationToken(params.token)
    .andThen(({ verificationId }) =>
      VerificationServices.getVerificationById(verificationId, ctx).map(
        (verification) => ({
          verification,
          verificationId,
        }),
      ),
    )
    .andThen(({ verification, verificationId }) => {
      const now = new Date();
      if (verification.expiresAt < now) {
        return errAsync(new AuthenticationError("Verification has expired"));
      }

      let userData: { email: string; name: string };
      try {
        userData = JSON.parse(verification.identifier);
      } catch {
        return errAsync(new AuthenticationError("Invalid verification data"));
      }

      return compareOTP(params.otp, verification.value).map((isMatch) => ({
        isMatch,
        email: userData.email,
        name: userData.name,
        verificationId,
      }));
    })
    .andThen(({ isMatch, email, name, verificationId }) =>
      isMatch
        ? UserDomain.createUser({ email, name })
            .asyncAndThen((user) => UserQueries.create(user, ctx))
            .map((user) => ({
              user,
              verificationId,
            }))
        : errAsync(new AuthenticationError("Invalid OTP")),
    )
    .andThen(({ user, verificationId }) =>
      UserServices.markUserAsVerified(user.id, ctx).map(() => ({
        user,
        verificationId,
      })),
    )
    .andThen(({ user, verificationId }) => {
      if (authMode === "better-auth") {
        return ResultAsync.fromPromise(
          createBetterAuthSession(user.id),
          (err) => new DatabaseError(String(err)),
        ).andThen(({ token }) =>
          VerificationServices.deleteVerification(verificationId, ctx).map(
            () => ({
              user,
              accessToken: token,
              refreshToken: token,
            }),
          ),
        );
      }
      return generateAccessToken(user.id, user.email, user.name).andThen(
        (accessToken) =>
          generateRefreshToken(user.id, user.email, user.name).andThen(
            (refreshToken) =>
              VerificationServices.deleteVerification(verificationId, ctx).map(
                () => ({
                  user,
                  accessToken,
                  refreshToken,
                }),
              ),
          ),
      );
    })
    .mapErr((error) => {
      logger.error(
        {
          code: error.code,
          message: error.message,
        },
        "Registration verification failed",
      );
      return error;
    });
