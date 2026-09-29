import { z } from "zod";

export const connectedClientSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  name: z.string(),
  scopes: z.string(),
  createdAt: z.date().or(z.string()),
});

export const connectedClientsSchema = z.array(connectedClientSchema);

export type ConnectedClient = z.infer<typeof connectedClientSchema>;
