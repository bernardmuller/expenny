import type { AppContext } from "@/lib/db/context";
import { AppResult, success, failure } from "@/lib/result";
import { NotFoundError } from "@/lib/errors/domain";
import { revokeClientAccess } from "../queries";

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
