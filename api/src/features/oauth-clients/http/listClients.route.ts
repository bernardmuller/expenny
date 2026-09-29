import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { errorResponseSchema } from "@/lib/errors/errorResponseSchema";
import { connectedClientsSchema } from "../types";

const tags = ["OAuth Clients"];

export const listClientsRoute = createRoute({
  path: "/oauth-clients",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      connectedClientsSchema,
      "Applications this user has granted access to",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});
