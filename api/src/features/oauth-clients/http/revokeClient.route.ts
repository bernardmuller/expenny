import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { errorResponseSchema } from "@/lib/errors/errorResponseSchema";

const tags = ["OAuth Clients"];

export const revokeClientRoute = createRoute({
  path: "/oauth-clients/{clientId}",
  method: "delete",
  tags,
  request: {
    params: z.object({
      clientId: z.string().min(1),
    }),
  },
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      z.object({
        revoked: z.boolean(),
        /** Access tokens that were live at revocation time. */
        tokensRemoved: z.number(),
      }),
      "Access revoked",
    ),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(
      errorResponseSchema,
      "The user has no access granted to this application",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorResponseSchema,
      "Internal server error",
    ),
  },
});
