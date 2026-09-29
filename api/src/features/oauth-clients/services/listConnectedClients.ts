import type { AppContext } from "@/lib/db/context";
import { AppResult } from "@/lib/result";
import type { ConnectedClient } from "../types";
import { getConsentsByUserId } from "../queries";

export const listConnectedClients = (
  userId: string,
  ctx: AppContext,
): AppResult<ConnectedClient[]> => getConsentsByUserId(userId, ctx);
