import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { authModeSchema } from "../types";

const tags = ["Auth"];

export const authModeRoute = createRoute({
  path: "/mode",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      authModeSchema,
      "Current auth mode (feature flag)",
    ),
  },
});