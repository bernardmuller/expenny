import type { AppContext } from "@/lib/db/context";
import { oauthAccessToken, oauthConsent } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { AppResult, fromDB } from "@/lib/result";
import { DatabaseError } from "@/lib/errors/domain";

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
