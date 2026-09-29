import configureOpenAPI from "@/lib/http/openapi";
import createApi from "@/lib/http/createApi";
import index from "@/lib/http/routes/index";
import { healthRouter as health } from "./features/health";
import { authRouter as auth } from "./features/auth";
import { userRouter as users } from "./features/users";
import { categoryRouter as categories } from "./features/categories";
import { transactionRouter as transactions } from "./features/transactions";
import { budgetRouter as budgets } from "./features/budgets";
import { recurringExpensesRouter as recurringExpenses } from "./features/recurring-expenses";
import { verificationRouter as verifications } from "./features/verifications";
import { chatRouter as chats } from "./features/chats";
import { notificationPreferencesRouter as notificationPreferences } from "./features/notification-preferences";
import { streakRouter as streaks } from "./features/streaks";
import { cronRouter as cron } from "./features/cron";
import { oauthClientRouter as oauthClients } from "./features/oauth-clients";
import { cors } from "hono/cors";
import env from "./env";
import { authMiddleware } from "@/lib/http/middleware/auth";
import { cronAuth } from "@/lib/http/middleware/cronAuth";
import {
  betterAuthInstance,
} from "@/lib/auth/better-auth";
import {
  oAuthDiscoveryMetadata,
  oAuthProtectedResourceMetadata,
} from "better-auth/plugins";

const app = createApi();

configureOpenAPI(app);

const routes = [
  index,
  auth,
  users,
  categories,
  transactions,
  health,
  budgets,
  recurringExpenses,
  verifications,
  chats,
  notificationPreferences,
  streaks,
  cron,
  oauthClients,
] as const;

app.use(
  "*",
  cors({
    origin:
      env.NODE_ENV === "development"
        ? (origin) => origin
        : [
            env.AUTH_URL,
            "http://localhost:3000",
            "http://10.233.1.2:3000",
            "http://10.233.1.1",
            "http://100.96.157.69:3000",
            "https://41.193.48.126",
            "https://100.64.210.48",
          ],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Access-Control-Allow-Origin",
    ],
    allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// OAuth 2.0 discovery documents — must be public, mounted at root
app.get("/.well-known/oauth-authorization-server", (c) =>
  oAuthDiscoveryMetadata(betterAuthInstance)(c.req.raw),
);
// RFC 8414 §3.1: for an issuer with a path component (ours is <origin>/auth),
// the well-known path is inserted before it. Clients differ on which form they
// try, so serve both.
app.get("/.well-known/oauth-authorization-server/*", (c) =>
  oAuthDiscoveryMetadata(betterAuthInstance)(c.req.raw),
);
app.get("/.well-known/oauth-protected-resource", (c) =>
  oAuthProtectedResourceMetadata(betterAuthInstance)(c.req.raw),
);

app.use("*", async (c, next) => {
  const path = c.req.path;

  if (
    path === "/" ||
    path === "/scalar" ||
    path === "/doc" ||
    path.startsWith("/auth") ||
    path.startsWith("/health") ||
    path.startsWith("/cron") ||
    path.startsWith("/.well-known")
  ) {
    return next();
  }

  return authMiddleware(c, next);
});

app.use("/cron/*", cronAuth);

app.route("/", index);
app.route("/auth", auth);
app.route("/", users);
app.route("/", budgets);
app.route("/", categories);
app.route("/", transactions);
app.route("/", recurringExpenses);
app.route("/", verifications);
app.route("/", chats);
app.route("/", notificationPreferences);
app.route("/", streaks);
app.route("/", cron);
// Deliberately not under /auth — that prefix skips authMiddleware and falls
// through to better-auth. Managing your own grants needs a web session.
app.route("/", oauthClients);

app.all("/auth/*", (c) => betterAuthInstance.handler(c.req.raw));

export type AppType = typeof app;

export default app;
