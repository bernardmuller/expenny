/* eslint-disable node/no-process-env */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(
	config({
		path: path.resolve(process.cwd(), ".env"),
	}),
);

const EnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	PORT: z.coerce.number().default(9999),
	LOG_LEVEL: z.enum([
		"fatal",
		"error",
		"warn",
		"info",
		"debug",
		"trace",
		"silent",
	]),
	DATABASE_URL: z.string(),
	AUTH_URL: z.url(),
	AUTH_SECRET: z.string(),
	RESEND_KEY: z.string(),
	MAIL_ADDRESS: z.string(),
	ENCRYPTION_KEY: z.string(),
	TELEGRAM_BOT_TOKEN: z.string(),
	CRON_SECRET: z.string(),
	AUTH_MODE: z.enum(["legacy", "better-auth"]).default("legacy"),
	BETTER_AUTH_SECRET: z.string().optional(),
	BETTER_AUTH_URL: z.string().url().optional(),
	GOOGLE_CLIENT_ID: z.string().optional(),
	GOOGLE_CLIENT_SECRET: z.string().optional()
});

export type env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line ts/no-redeclare
const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
	console.error("❌ Invalid env:");
	console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
	process.exit(1);
}

export default env!;
