import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { randomUUID } from "node:crypto";
import env from "@/env";
import { db } from "@/lib/db";
import { betterAuthSchema } from "@/lib/db/schema";

export const authMode = env.AUTH_MODE;

export const betterAuthUrl =
	env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT}`;

export const betterAuthSecret = env.BETTER_AUTH_SECRET || env.AUTH_SECRET;

export const betterAuthInstance = betterAuth({
	appName: "Expenny",
	secret: betterAuthSecret,
	baseURL: betterAuthUrl,
	basePath: "/auth",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: betterAuthSchema,
	}),
	trustedOrigins: [
		env.AUTH_URL,
		"http://localhost:3000",
		"http://localhost:4173",
		betterAuthUrl,
	],
	socialProviders:
		env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET,
					},
				}
			: {},
	advanced: {
		cookiePrefix: "expenny",
		defaultCookieAttributes: {
			sameSite: "lax",
			secure: env.NODE_ENV === "production",
		},
		database: {
			generateId: () => randomUUID(),
		},
	},
});