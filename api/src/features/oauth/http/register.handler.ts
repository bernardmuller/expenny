import type { Context } from "hono";
import { createContext } from "@/lib/db/context";
import { registerClient } from "../services";
import type { RegisterClientParams } from "../types";
import { DatabaseError } from "@/lib/errors/domain";

export const registerOAuthClientHandler = async (c: Context) => {
  const params = (await c.req.json()) as RegisterClientParams;
  const ctx = createContext();
  const result = await registerClient(params, ctx);

  return result.match(
    (client) => c.json(client, 201),
    (error) => {
      if (error instanceof DatabaseError) {
        return c.json(
          { error: "server_error", error_description: error.message },
          500,
        );
      }
      return c.json(
        { error: "invalid_request", error_description: error.message },
        400,
      );
    },
  );
};