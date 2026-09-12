import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { oauthMetadataSchema } from "../types";

const tags = ["OAuth"];

export const metadataRoute = createRoute({
  path: "/oauth/metadata",
  method: "get",
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(
      oauthMetadataSchema,
      "Authorization server issuer metadata (RFC 9728)",
    ),
  },
});