import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { oauthTokenResponseSchema, oauthErrorSchema } from "../types";

const tags = ["OAuth"];

export const tokenRoute = createRoute({
  path: "/oauth/token",
  method: "post",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      oauthTokenResponseSchema,
      "Token response (client_credentials)",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      oauthErrorSchema,
      "Invalid or unsupported request",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      oauthErrorSchema,
      "Client authentication failed",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      oauthErrorSchema,
      "Server error",
    ),
  },
});