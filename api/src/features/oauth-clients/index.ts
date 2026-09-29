import { createRouter } from "@/lib/http/createApi";
import { listClientsRoute } from "./http/listClients.route";
import { listClientsHandler } from "./http/listClients.handler";
import { revokeClientRoute } from "./http/revokeClient.route";
import { revokeClientHandler } from "./http/revokeClient.handler";

export const oauthClientRouter = createRouter()
  .openapi(listClientsRoute, listClientsHandler)
  .openapi(revokeClientRoute, revokeClientHandler);
