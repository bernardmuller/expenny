import type { AppContext } from "@/lib/db/context";
import { oauthClients } from "@/lib/db/schema";
import type { OAuthClient, NewOAuthClient } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AppResult, failure, fromDB, success } from "@/lib/result";
import { DatabaseError } from "@/lib/errors/domain";

export const getOAuthClientByClientId = (
  clientId: string,
  ctx: AppContext,
): AppResult<OAuthClient | undefined, DatabaseError> =>
  fromDB(
    ctx.db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1),
  ).map(([client]) => client);

export const createOAuthClient = (
  client: NewOAuthClient,
  ctx: AppContext,
): AppResult<OAuthClient, DatabaseError> =>
  fromDB(
    ctx.db.insert(oauthClients).values(client).returning(),
  ).andThen(([created]) =>
    created ? success(created) : failure(new DatabaseError("Failed to create OAuth client")),
  );