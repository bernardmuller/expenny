import { randomBytes } from "node:crypto";
import type { AppContext } from "@/lib/db/context";
import * as OAuthQueries from "../queries";
import type { RegisterClientParams } from "../types";
import { oauthGrantTypes } from "../types";
import { hashSecret } from "@/lib/utils/hashSecret";
import { generateUuid } from "@/lib/utils/generateUuid";
import { AppResult } from "@/lib/result";

const generateClientId = () => `cln_${randomBytes(16).toString("base64url")}`;
const generateClientSecret = () => `sec_${randomBytes(32).toString("base64url")}`;

type GrantType = (typeof oauthGrantTypes)[number];

export const registerClient = (
  params: RegisterClientParams,
  ctx: AppContext,
): AppResult<{
  client_id: string;
  client_secret: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
  client_name: string;
  redirect_uris?: string[];
  grant_types: GrantType[];
  token_endpoint_auth_method: string;
  scope?: string;
}> => {
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();
  const grantTypes: GrantType[] = params.grant_types ?? ["client_credentials"];

  return hashSecret(clientSecret)
    .andThen((hashedClientSecret) =>
      OAuthQueries.createOAuthClient(
        {
          id: generateUuid(),
          clientId,
          clientSecret: hashedClientSecret,
          clientName: params.client_name,
          clientUri: params.client_uri ?? null,
          redirectUris: params.redirect_uris
            ? JSON.stringify(params.redirect_uris)
            : null,
          grantTypes: JSON.stringify(grantTypes),
          scopes: params.scope ?? "openid profile email",
          tokenEndpointAuthMethod:
            params.token_endpoint_auth_method ?? "client_secret_basic",
          disabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        ctx,
      ),
    )
    .map((client) => ({
      client_id: client.clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_secret_expires_at: 0,
      client_name: client.clientName,
      redirect_uris: params.redirect_uris,
      grant_types: grantTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      scope: client.scopes,
    }));
};