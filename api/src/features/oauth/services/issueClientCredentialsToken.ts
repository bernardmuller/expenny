import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { AppContext } from "@/lib/db/context";
import * as OAuthQueries from "../queries";
import { compareSecret } from "@/lib/utils/hashSecret";
import { AppResult } from "@/lib/result";
import { AuthenticationError } from "@/lib/errors/domain";
import { errAsync, ResultAsync } from "neverthrow";

const OAUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;

const getJwtSecret = (): string => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not defined in environment variables");
  }
  return secret;
};

export const issueClientCredentialsToken = (
  {
    clientId,
    clientSecret,
    scope,
  }: { clientId: string; clientSecret: string; scope?: string },
  ctx: AppContext,
): AppResult<{
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
}> =>
  OAuthQueries.getOAuthClientByClientId(clientId, ctx).andThen((client) => {
    if (!client) {
      return errAsync(new AuthenticationError("Client authentication failed"));
    }

    if (client.disabled) {
      return errAsync(new AuthenticationError("Client is disabled"));
    }

    let grantTypes: string[] = [];
    try {
      grantTypes = JSON.parse(client.grantTypes);
    } catch {
      grantTypes = [];
    }

    if (!grantTypes.includes("client_credentials")) {
      return errAsync(
        new AuthenticationError(
          "Client is not authorized for client_credentials grant",
        ),
      );
    }

    return compareSecret(clientSecret, client.clientSecret).andThen(
      (matches) => {
        if (!matches) {
          return errAsync(
            new AuthenticationError("Client authentication failed"),
          );
        }

        const requestedScope = scope || client.scopes;

        return ResultAsync.fromPromise(
          (async () => {
            const accessToken = jwt.sign(
              {
                clientId: client.clientId,
                scope: requestedScope,
                token_use: "client_credentials",
                jti: randomUUID(),
              },
              getJwtSecret(),
              { expiresIn: OAUTH_ACCESS_TOKEN_TTL_SECONDS },
            );

            return {
              access_token: accessToken,
              token_type: "Bearer" as const,
              expires_in: OAUTH_ACCESS_TOKEN_TTL_SECONDS,
              scope: requestedScope,
            };
          })(),
          (error) =>
            new AuthenticationError(
              `OAuth token generation failed: ${String(error)}`,
            ),
        );
      },
    );
  });