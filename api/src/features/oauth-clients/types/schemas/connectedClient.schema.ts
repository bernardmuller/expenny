import { z } from "zod";

/**
 * An OAuth application the user has granted access to, as shown on the
 * "MCP Connection" screen.
 */
export const connectedClientSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  /** Registered application name — what the user should recognise. */
  name: z.string(),
  /** Space-separated, as stored by better-auth. */
  scopes: z.string(),
  createdAt: z.date().or(z.string()),
});

export const connectedClientsSchema = z.array(connectedClientSchema);

export type ConnectedClient = z.infer<typeof connectedClientSchema>;
