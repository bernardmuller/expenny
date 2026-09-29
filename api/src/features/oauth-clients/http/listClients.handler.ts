import type { Context } from "hono";
import { createContext } from "@/lib/db/context";
import { mapErrorToResponse } from "@/lib/http/errorMapper";
import { listConnectedClients } from "../services";

export const listClientsHandler = async (c: Context) => {
  const user = c.get("user");
  const ctx = createContext();
  const result = await listConnectedClients(user.userId, ctx);

  return result.match(
    (clients) => c.json(clients, 200),
    (error) => mapErrorToResponse(error, c),
  );
};
