import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { mcp, jwt } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import env from "@/env";
import { db } from "@/lib/db";
import { betterAuthSchema, users } from "@/lib/db/schema";

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

/**
 * Only one account may use this deployment. Signing in with any other Google
 * address is refused before a user or session is written, so a stranger never
 * ends up with a valid cookie.
 */
const allowedEmail = (
	env.ALLOWED_EMAIL ?? "b.mullerjnr@gmail.com"
).toLowerCase();

function isAllowedEmail(email?: string | null): boolean {
	return !!email && email.toLowerCase() === allowedEmail;
}

function privateDeploymentError() {
	return new APIError("FORBIDDEN", {
		message: `This app is private to ${allowedEmail}.`,
	});
}

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
	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					if (!isAllowedEmail(user.email)) {
						throw privateDeploymentError();
					}
					return { data: user };
				},
			},
		},
		session: {
			create: {
				before: async (session) => {
					// Existing accounts are checked too, so a user created before
					// the allowlist existed cannot sign back in.
					const [account] = await db
						.select({ email: users.email })
						.from(users)
						.where(eq(users.id, session.userId))
						.limit(1);

					if (!isAllowedEmail(account?.email)) {
						throw privateDeploymentError();
					}
				},
			},
		},
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
