import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import env from "@/env";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export const sessionCookieName = "expenny.session_token";

export const createBetterAuthSession = async (userId: string) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  const token = `${randomUUID()}${randomUUID()}`;

  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    token,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return { token, expiresAt };
};

export const buildSessionCookie = (token: string) => {
  const secure = env.NODE_ENV === "production";
  return `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
    SESSION_DURATION_MS / 1000
  }${secure ? "; Secure" : ""}`;
};

export const readSessionCookie = (cookieHeader: string | undefined) => {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === sessionCookieName) {
      return rest.join("=");
    }
  }
  return undefined;
};

export const findUserBySessionToken = async (token: string) => {
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { userId: row.userId, email: row.email, name: row.name };
};