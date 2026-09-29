import type { AppContext } from "@/lib/db/context";
import { AppResult, success, failure } from "@/lib/result";
import { NotFoundError } from "@/lib/errors/domain";
import { revokeClientAccess } from "../queries";

/**
 * Revoke one application's access to this user's account.
 *
 * Scoped to `userId` in the query itself, so a client id belonging to someone
 * else's consent simply matches nothing and reads as "not connected" — there is
 * no path here to revoke another user's grant.
 */
export const revokeClient = (
  userId: string,
  clientId: string,
  ctx: AppContext,
): AppResult<{ revoked: true; tokensRemoved: number }> =>
  revokeClientAccess(userId, clientId, ctx).andThen((result) =>
    result.consentsRemoved === 0 && result.tokensRemoved === 0
      ? failure(new NotFoundError("No access to revoke for this application"))
      : success({ revoked: true as const, tokensRemoved: result.tokensRemoved }),
  );
