import type { AppContext } from "@/lib/db/context";
import { oauthConsent, oauthApplication } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { AppResult, fromDB } from "@/lib/result";
import { DatabaseError } from "@/lib/errors/domain";
import type { ConnectedClient } from "../types";

/**
 * The OAuth applications this user has actively consented to, newest first.
 *
 * Joined to `oauth_application` for the registered name — the consent row
 * carries only the generated client id, which means nothing to a user.
 */
export const getConsentsByUserId = (
  userId: string,
  ctx: AppContext,
): AppResult<ConnectedClient[], DatabaseError> =>
  fromDB(
    ctx.db
      .select({
        id: oauthConsent.id,
        clientId: oauthConsent.clientId,
        name: oauthApplication.name,
        scopes: oauthConsent.scopes,
        createdAt: oauthConsent.createdAt,
      })
      .from(oauthConsent)
      .innerJoin(
        oauthApplication,
        eq(oauthConsent.clientId, oauthApplication.clientId),
      )
      .where(
        and(
          eq(oauthConsent.userId, userId),
          eq(oauthConsent.consentGiven, true),
        ),
      )
      .orderBy(desc(oauthConsent.createdAt)),
  );
