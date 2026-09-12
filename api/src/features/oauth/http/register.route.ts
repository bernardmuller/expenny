import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent, jsonContentRequired } from "stoker/openapi/helpers";
import {
  registerClientSchema,
  registerClientResponseSchema,
  oauthErrorSchema,
} from "../types";

const tags = ["OAuth"];

export const registerRoute = createRoute({
  path: "/oauth/register",
  method: "post",
  tags,
  request: {
    body: jsonContentRequired(
      registerClientSchema,
      "Dynamic client registration (RFC 7591)",
    ),
  },
  responses: {
    [HttpStatusCodes.CREATED]: jsonContent(
      registerClientResponseSchema,
      "Registered client",
    ),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(
      oauthErrorSchema,
      "Invalid request",
    ),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      oauthErrorSchema,
      "Validation error",
    ),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      oauthErrorSchema,
      "Internal server error",
    ),
  },
});