import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { mcpUserinfoSchema } from "../types";

const tags = ["Auth"];

export const mcpUserinfoRoute = createRoute({
  path: "/mcp/userinfo",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      mcpUserinfoSchema,
      "Claims for the bearer's MCP access token",
    ),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(
      z.object({ error: z.string() }),
      "Missing, invalid or expired access token",
    ),
  },
});
