# Better Auth MCP + shared social login — implementation plan

Branch: `feat/oauth` (base: `dev`). Written 2026-09-23.

## Context

`feat/oauth` added `api/src/features/oauth/*` — a hand-rolled RFC 7591 registration + token
endpoint supporting only the `client_credentials` grant. That grant authenticates an
application, not a person, so the issued token carries no `userId`
(`api/src/features/oauth/services/issueClientCredentialsToken.ts:69`). Expenny's data is
entirely per-user, so the token cannot authorize a real tool call — in fact
`api/src/lib/http/middleware/auth.ts:54` rejects it outright, because `decodeAccessToken`
(`api/src/lib/utils/jwt.ts:111`) requires `userId`/`email`/`name`. Discovery also sits at
non-standard paths (`/auth/oauth/metadata`) advertising `response_types_supported: []`, and
nothing in the stack ever returns a 401 with `WWW-Authenticate`, so no MCP client can find
or start the flow. Registration is unauthenticated (`api/src/app.ts:76` skips all `/auth/*`),
which with `client_credentials` and no human in the loop makes it an open token factory.

We replace it with better-auth's own MCP/OIDC provider — already installed
(`better-auth@1.3.32`; `better-auth/plugins` exports `mcp`, `withMcpAuth`,
`oAuthDiscoveryMetadata`, `oAuthProtectedResourceMetadata`) — and **cut over fully**: the
`legacy` JWT path and the `AUTH_MODE` flag are deleted, not kept in parallel.

Two flows share one better-auth instance and one Google provider config:

1. **Web login** — user signs in at `/login` with OTP or "Continue with Google".
2. **MCP login** — Claude/Cursor hits the MCP server, is bounced through
   `/auth/mcp/authorize`, lands on Expenny's `/login`, signs in with **the same** OTP or
   Google button, consents, and the client receives a refreshable token bound to that user.

Flow 2 is flow 1 plus a round trip. The real work is making `/login` *resumable*: it must
carry a pending authorize request through OTP **and** through the full-page Google redirect,
then hand control back to the API.

**Migration note:** cutting over invalidates every legacy JWT in users' localStorage. They
get one 401, `clearTokens()` fires, and they land on `/login`. Acceptable, but it is a forced
re-login for all active users — time the deploy accordingly.

## Phase 1 — API: enable the MCP provider

### `api/src/lib/auth/better-auth.ts`
Add plugins to the existing `betterAuth({...})` call:

```ts
plugins: [
  mcp({
    loginPage: `${env.AUTH_URL}/login`,        // the WEB origin, not the API
    resource: env.MCP_RESOURCE_URL,            // e.g. https://mcp.expenny.co.za/mcp
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
  jwt(),   // provides /auth/jwks, required by the protected-resource metadata
]
```

Also fix `trustedOrigins` (`:24`) — it currently hardcodes `localhost:3000`/`4173`. Drive it
off `env.AUTH_URL` + `env.BETTER_AUTH_URL` plus the dev localhosts. Google's `callbackURL`
and every OAuth redirect are validated against this list; a missing entry surfaces only as
"Could not start Google sign-in".

Remove the `authMode` export (`:8`).

### `api/src/lib/db/schema.ts`
- Delete `oauthClients` (`:483`) and its `OAuthClient`/`NewOAuthClient` types. Add a
  migration that **drops** the table — `api/drizzle/0020_oauth_clients.sql` may already be
  applied locally, so deleting the file is not enough.
- Add the plugin tables: `oauthApplication`, `oauthAccessToken`, `oauthConsent` (from
  `better-auth/plugins/oidc-provider`) and `jwks` (from `better-auth/plugins/jwt`).
- Register them in `betterAuthSchema` (`:513`) so the existing `modelName` loop applies.
- Generate with `npx @better-auth/cli generate` first to confirm field names, then
  `pnpm drizzle-kit generate`.

### `api/src/app.ts`
Mount discovery at the **root** — this is the single reason clients can't find anything today:

```ts
app.get("/.well-known/oauth-authorization-server", (c) =>
  oAuthDiscoveryMetadata(betterAuthInstance)(c.req.raw))
app.get("/.well-known/oauth-protected-resource", (c) =>
  oAuthProtectedResourceMetadata(betterAuthInstance)(c.req.raw))
```

Add both to the public skip list beside `/auth`, `/health`, `/cron` (`:72-79`). Keep the
`app.all("/auth/*", betterAuthInstance.handler)` catch-all (`:101`) — the plugin serves
`/auth/mcp/authorize`, `/auth/oauth2/token`, `/auth/oauth2/register`,
`/auth/oauth2/consent`, `/auth/oauth2/userinfo` and `/auth/jwks` beneath it.

### `api/src/lib/http/middleware/auth.ts`
Rewrite to a single path — no `betterAuthActive` branching, no `decodeAccessToken`:

1. `betterAuthInstance.api.getMcpSession({ headers })` → MCP-issued bearer token.
2. else `betterAuthInstance.api.getSession({ headers })` → web session cookie.
3. else 401.

Set `c.set("user", { userId, email, name })` in both cases — the shape every downstream
handler already consumes, so no handler changes.

### Fix the hand-rolled session (blocking — do this first)
`api/src/lib/auth/session.ts:14` mints a token as `randomUUID()+randomUUID()` and
`buildSessionCookie` writes it raw. better-auth signs its session cookies, so a cookie this
code wrote is **not** recognised by better-auth's own `getSession` — meaning
`/auth/mcp/authorize` never sees an OTP-authenticated user and bounces back to `/login`
forever.

Replace `createBetterAuthSession` with better-auth's internals so OTP login yields a real
session and a correctly signed cookie:

```ts
const ctx = await betterAuthInstance.$context
const session = await ctx.internalAdapter.createSession(userId, /* ctx */)
// then set the cookie with better-auth's own cookie helper,
// not a hand-built Set-Cookie string
```

Callers to update: `api/src/features/auth/http/loginAttempt.handler.ts:37`,
`api/src/features/auth/services/loginAttempt.ts:49`, and the matching `registerVerify.*`
pair. Delete `buildSessionCookie` / `readSessionCookie` / `findUserBySessionToken` once the
middleware uses `getSession`.

**Gate:** `curl -b "<cookie>" localhost:8080/auth/get-session` must return the user before
starting any other phase. If it doesn't, nothing downstream can work.

### Delete (legacy cutover)
- `api/src/features/oauth/` — whole directory, plus its re-exports in
  `api/src/features/auth/index.ts:14-37`.
- `api/src/lib/utils/jwt.ts`: `generateAccessToken`, `generateRefreshToken`,
  `decodeAccessToken`, `decodeRefreshToken`. **Keep `generateVerificationToken`** — the OTP
  handshake in `loginRequest.ts:43` and `registerRequest.ts:54` still uses it.
- `api/src/features/auth/services/refreshTokens.ts`, `http/refresh.route.ts`,
  `http/refresh.handler.ts`, and the `.openapi(refreshRoute, …)` line in the auth router.
- `env.AUTH_MODE` (`api/src/env.ts:33`) and every `authMode === "better-auth"` branch.
- **Keep `/auth/mode`** but trim it to `{ google: boolean }` — the login page still needs to
  know whether to render the Google button. Rename the schema/handler accordingly
  (`authConfig` rather than `authMode`).

New env: `MCP_RESOURCE_URL` (optional, default `${BETTER_AUTH_URL}/mcp`).

## Phase 2 — Web: one login page serving both flows

### `web/src/routes/login.tsx`
The page must survive a full-page navigation to Google and back, so the pending authorize
request goes in `sessionStorage`, not React state.

1. **Capture** — on mount, read `window.location.search`. If it carries the authorize params
   the mcp plugin forwards, persist the full resume URL under a new
   `STORAGE_KEYS.PENDING_OAUTH` (`web/src/lib/storage/storage-keys.ts:1`).
   *First implementation step: call `/auth/mcp/authorize?...` once with no session and read
   the actual `Location` header to confirm exactly which params better-auth appends to
   `loginPage`. Build the capture against that, not an assumption.*
2. **Relax the guard** — `beforeLoad` redirects to `/` whenever `hasTokens()` (`:21-25`). An
   already-signed-in user arriving from an MCP authorize must resume it instead of being
   bounced to the dashboard.
3. **OTP path** — `handleOtpSubmit` (`:54`) currently does `navigate({ to: '/' })`. If a
   pending authorize exists, `window.location.href = <resume url>` — a real navigation, so
   the API sees the freshly-set session cookie.
4. **Google path** — `handleGoogleLogin` (`:62`) sends `callbackURL: ${origin}/login`. Keep
   the callback on the web origin (it must be in `trustedOrigins`) but round-trip the pending
   request: `callbackURL: ${origin}/login?resume=1`. On load with `resume=1`,
   `main.tsx`'s `bootstrapSessionFromCookie()` has already populated storage, so the page
   reads `PENDING_OAUTH` and navigates to the resume URL.
   **This is what makes one Google button serve both flows** — one provider config, one
   Google consent screen; only the landing differs.
5. No pending request → unchanged (`navigate({ to: '/' })`).

### `web/src/routes/oauth.consent.tsx` (new)
Backs `oidcConfig.consentPage`. Reads `client_id`, `scope`, `consent_code` from the query,
renders client name + requested scopes with the existing `Card`/`Button`/`Separator`
primitives, POSTs `{ accept, consent_code }` to `/auth/oauth2/consent` with
`credentials: 'include'`, then follows the returned `redirectURI`. Deny posts `accept: false`.
Guard it with `requireAuth()` (`web/src/lib/auth/route-guard.ts`).

### Legacy removal on the web
- Delete the mode concept in `web/src/lib/auth/auth-mode.ts`; keep a `getGoogleConfigured()`
  fed by the trimmed `/auth/mode`. Update its callers: `main.tsx:37`, `login.tsx:17,38-39`,
  `client.ts:63`, `auth-provider.tsx:27`, `session-sync.ts:5,31`, `use-register-verify.ts:45`.
- Delete `web/src/lib/http/hooks/use-refresh-token.ts` and the `refreshTokens` /
  `refreshPromise` block in `web/src/lib/http/client.ts:19-83`. A 401 now means:
  `clearTokens()` → `/login`.
- `web/src/lib/auth/decode-token.ts`: tokens are opaque now, so `decodeJwt` is dead. Collapse
  `getUserIdFromAccessToken` to read `getStoredCurrentUser()` only. **Signature unchanged**,
  so its ~10 call sites (`profile.index.tsx`, `budgets/new.tsx`, `use-create-transaction.ts`,
  `budget-detail.ts`, `profile.penny-bot.tsx`, `profile.recurring-expenses.tsx`,
  `use-update-user-preferences.ts`, `budgets/$id.expenses.tsx`) need no edits.
- `web/src/lib/http/with-token.ts` stays — it carries the OTP *verification* token, which is
  unrelated to access tokens.

### `web/src/routes/profile.mcp-token.tsx`
Replace the paste-a-JWT UI entirely (the `:86-91` placeholder and the token card) with
connection instructions —
`claude mcp add --transport http expenny https://mcp.expenny.co.za/mcp` — plus a list of
authorised MCP clients read from `oauthConsent`, each with a revoke button. Rename the route
to `/profile/mcp`, since there is no token to show.

### Small fixes already in the working tree
- `web/src/lib/auth/auth-mode.ts:20` sends a header named `"Acces-Control-Allow-Origin"` —
  misspelled, and a *response* header set on a request. Delete the `headers` object.
- `web/vite.config.ts:36-39` proxies `/auth` and `/oauth`; add `/.well-known`.

## Phase 3 — Go MCP server (`cmd/mcp/main.go`)

1. Delete `OAuthClientClaims` (`:33-38`), `authMode()` (`:73-79`), the legacy `AuthUser` HS256
   path, and both `authMode()` branches (`:88-101`, `:129-139`).
2. Move auth out of `server.ToolHandlerFunc` into an `http.Handler` middleware wrapping
   `server.NewStreamableHTTPServer`. **This is the change that makes clients auto-discover
   the flow** — the current tool middleware can only return a Go error, which is why no 401
   is ever emitted. On missing/invalid token:
   ```
   HTTP/1.1 401 Unauthorized
   WWW-Authenticate: Bearer resource_metadata="{API_URL}/.well-known/oauth-protected-resource"
   ```
3. Validate by calling `GET {API_URL}/auth/oauth2/userinfo` with the bearer token; use the
   returned `sub`/`email`/`name` as the principal. The mcp plugin issues **opaque** tokens
   stored in `oauthAccessToken`, so local JWT verification isn't an option — introspection is.
   Add a 60s TTL cache keyed by token hash so this is one round-trip per connection, not per
   tool call.
4. `whoami` returns the user's name and email again — drop the client-id greeting.
5. New env `EXPENNY_API_URL`; make the port configurable (`PORT`, default `:8080`) — it
   hardcodes `:8080` (`:156`), which is the API's port in `api/.example.env`, so both can't
   run locally today.

## Phase 4 — Env & docs

- `api/.example.env`: drop `AUTH_MODE`, add `MCP_RESOURCE_URL`. `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` become required rather than
  optional (update `api/src/env.ts` accordingly).
- `docs/mcp-server.md`: replace paste-a-token with the OAuth connect flow; add
  `EXPENNY_API_URL` to the Lambda env list.

## Verification

1. API on `:8080`, MCP on `:8081`, web on `:3000`.
2. **Gate** — OTP-login via the web app, then
   `curl -b "<session cookie>" localhost:8080/auth/get-session` returns the user. If not,
   stop: Phase 1's session fix is incomplete and nothing else can pass.
3. `curl -s localhost:8080/.well-known/oauth-authorization-server | jq` — must include
   `authorization_endpoint`, `"code"` in `response_types_supported`, and `"S256"` in
   `code_challenge_methods_supported`.
4. `curl -i -X POST localhost:8081/mcp` with no token — `401` carrying
   `WWW-Authenticate: Bearer resource_metadata=…`.
5. `npx @modelcontextprotocol/inspector` → `http://localhost:8081/mcp`. It must
   self-register, open Expenny `/login`, and **both** paths must complete:
   - OTP → consent → `whoami` returns the signed-in user's name and email;
   - sign out, reconnect, **Continue with Google** → consent → same result.
6. Web regression: log in with Google at `/login` with no pending authorize — must land on
   `/dashboard`, not a consent screen.
7. `claude mcp add --transport http expenny http://localhost:8081/mcp`; call `whoami`.
8. Set `accessTokenExpiresIn: 60`, wait it out, call a tool again — the client must silently
   refresh rather than 401 out. This is the regression the old flow could never pass.
9. Revoke the client from `/profile/mcp` and confirm the next tool call 401s.
10. Run the API test suite and `pnpm build` in `web/` to catch the dangling imports the legacy
    deletions will leave behind.
