import type { Context } from "hono";
import { createContext } from "@/lib/db/context";
import { issueClientCredentialsToken } from "../services";
import { DatabaseError } from "@/lib/errors/domain";

export const oauthTokenHandler = async (c: Context) => {
  const contentType = c.req.header("Content-Type") ?? "";
  let body: {
    grant_type?: string;
    client_id?: string;
    client_secret?: string;
    scope?: string;
  } = {};

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const raw = await c.req.text();
    body = Object.fromEntries(new URLSearchParams(raw));
  } else {
    body = await c.req.json().catch(() => ({}));
  }

  if (body.grant_type !== "client_credentials") {
    return c.json(
      {
        error: "unsupported_grant_type",
        error_description: "Only client_credentials is supported",
      },
      400,
    );
  }

  let clientId = body.client_id;
  let clientSecret = body.client_secret;

  const authHeader = c.req.header("Authorization");
  if (!clientId && authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex >= 0) {
      clientId = decoded.slice(0, separatorIndex);
      clientSecret = decoded.slice(separatorIndex + 1);
    }
  }

  if (!clientId || !clientSecret) {
    return c.json(
      {
        error: "invalid_request",
        error_description: "Missing client credentials",
      },
      400,
    );
  }

  const ctx = createContext();
  const result = await issueClientCredentialsToken(
    { clientId, clientSecret, scope: body.scope },
    ctx,
  );

  return result.match(
    (tokenResponse) => c.json(tokenResponse, 200),
    (error) => {
      if (error instanceof DatabaseError) {
        return c.json(
          { error: "server_error", error_description: error.message },
          500,
        );
      }
      return c.json(
        { error: "invalid_client", error_description: error.message },
        401,
      );
    },
  );
};