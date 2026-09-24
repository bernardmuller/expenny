import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { mcpUserinfoSchema } from "../types";

const tags = ["Auth"];

/**
 * OIDC userinfo for MCP access tokens.
 *
 * better-auth's mcp plugin advertises `${baseURL}/mcp/userinfo` in its
 * discovery metadata but never registers an endpoint for it, so resource
 * servers (cmd/mcp) have no way to introspect the opaque tokens it issues.
 * This fills that gap at the advertised path — it is matched ahead of
 * better-auth's `/auth/*` catch-all because the auth router is mounted first.
 */
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
