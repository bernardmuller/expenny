import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { mcp, jwt } from "better-auth/plugins";
import { randomUUID } from "node:crypto";
import env from "@/env";
import { db } from "@/lib/db";
import { betterAuthSchema } from "@/lib/db/schema";

export const betterAuthUrl =
	env.BETTER_AUTH_URL ?? `http://localhost:${env.PORT}`;

export const betterAuthSecret = env.BETTER_AUTH_SECRET || env.AUTH_SECRET;

const mcpResourceUrl =
	env.MCP_RESOURCE_URL ?? `${betterAuthUrl}/mcp`;

const googleRedirectURI =
	env.GOOGLE_REDIRECT_URI ?? `${env.AUTH_URL}/auth/callback/google`;

const trustedOrigins = [
	env.AUTH_URL,
	betterAuthUrl,
	"http://localhost:3000",
	"http://localhost:4173",
].filter(Boolean) as string[];

export const betterAuthInstance = betterAuth({
	appName: "Expenny",
	secret: betterAuthSecret,
	baseURL: betterAuthUrl,
	basePath: "/auth",
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: betterAuthSchema,
	}),
	logger: { level: "debug" },
	trustedOrigins,
	socialProviders:
		env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET,
						redirectURI: googleRedirectURI,
					},
				}
			: {},
	onAPIError: {
		errorURL: `${env.AUTH_URL}/login`,
	},
	plugins: [
		mcp({
			loginPage: `${env.AUTH_URL}/login`,
			resource: mcpResourceUrl,
			oidcConfig: {
				loginPage: `${env.AUTH_URL}/login`,
				consentPage: `${env.AUTH_URL}/oauth/consent`,
				allowDynamicClientRegistration: true,
				requirePKCE: true,
				scopes: ["openid", "profile", "email", "offline_access"],
				accessTokenExpiresIn: 3600,
				refreshTokenExpiresIn: 60 * 60 * 24 * 30,
			},
		}),
		jwt(),
	],
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
