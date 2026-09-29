import type { AppContext } from "@/lib/db/context";
import { oauthAccessToken, oauthConsent } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { AppResult, fromDB } from "@/lib/result";
import { DatabaseError } from "@/lib/errors/domain";

/**
 * Cut one application off from one user's account.
 *
 * Deleting the issued tokens is the part that actually revokes: better-auth
 * resolves a bearer token by looking the row up by value, so once it is gone
 * the token stops authenticating immediately. Dropping only the consent row
 * would leave every live access and refresh token working until it expired —
 * up to 30 days for a refresh token.
 *
 * Both deletes run in one transaction so access can never be half-revoked.
 * Returns the number of tokens that were live at the time.
 */
export const revokeClientAccess = (
  userId: string,
  clientId: string,
  ctx: AppContext,
): AppResult<{ consentsRemoved: number; tokensRemoved: number }, DatabaseError> =>
  fromDB(
    ctx.db.transaction(async (tx) => {
      const tokens = await tx
        .delete(oauthAccessToken)
        .where(
          and(
            eq(oauthAccessToken.userId, userId),
            eq(oauthAccessToken.clientId, clientId),
          ),
        )
        .returning({ id: oauthAccessToken.id });

      const consents = await tx
        .delete(oauthConsent)
        .where(
          and(
            eq(oauthConsent.userId, userId),
            eq(oauthConsent.clientId, clientId),
          ),
        )
        .returning({ id: oauthConsent.id });

      return {
        consentsRemoved: consents.length,
        tokensRemoved: tokens.length,
      };
    }),
  );
