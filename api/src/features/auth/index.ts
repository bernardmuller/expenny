import { createRouter } from "@/lib/http/createApi";
import { registerRequestRoute } from "./http/registerRequest.route";
import { registerRequestHandler } from "./http/registerRequest.handler";
import { registerVerifyRoute } from "./http/registerVerify.route";
import { registerVerifyHandler } from "./http/registerVerify.handler";
import { loginRequestRoute } from "./http/loginRequest.route";
import { loginRequestHandler } from "./http/loginRequest.handler";
import { loginAttemptRoute } from "./http/loginAttempt.route";
import { loginAttemptHandler } from "./http/loginAttempt.handler";
import { refreshRoute } from "./http/refresh.route";
import { refreshHandler } from "./http/refresh.handler";
import { authModeRoute } from "./http/mode.route";
import { authModeHandler } from "./http/mode.handler";
import {
  oauthRegisterRoute,
  oauthRegisterClientHandler,
  oauthTokenRoute,
  oauthTokenHandler,
  oauthMetadataRoute,
  oauthMetadataHandler,
} from "@/features/oauth";
import { authMode } from "@/lib/auth/better-auth";

let authRouter = createRouter()
  .openapi(registerRequestRoute, registerRequestHandler)
  .openapi(registerVerifyRoute, registerVerifyHandler)
  .openapi(loginRequestRoute, loginRequestHandler)
  .openapi(loginAttemptRoute, loginAttemptHandler)
  .openapi(refreshRoute, refreshHandler)
  .openapi(authModeRoute, authModeHandler);

if (authMode === "better-auth") {
  authRouter = authRouter
    .openapi(oauthRegisterRoute, oauthRegisterClientHandler)
    .openapi(oauthTokenRoute, oauthTokenHandler)
    .openapi(oauthMetadataRoute, oauthMetadataHandler);
}

export { authRouter };
