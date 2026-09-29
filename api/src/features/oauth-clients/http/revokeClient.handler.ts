import type { Context } from "hono";
import { createContext } from "@/lib/db/context";
import { mapErrorToResponse } from "@/lib/http/errorMapper";
import { revokeClient } from "../services";

export const revokeClientHandler = async (c: Context) => {
  const user = c.get("user");
  const clientId = c.req.param("clientId");
  const ctx = createContext();
  const result = await revokeClient(user.userId, clientId, ctx);

  return result.match(
    (data) => c.json(data, 200),
    (error) => mapErrorToResponse(error, c),
  );
};
