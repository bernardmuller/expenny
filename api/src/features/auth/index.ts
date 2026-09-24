import { createRouter } from "@/lib/http/createApi";
import { registerRequestRoute } from "./http/registerRequest.route";
import { registerRequestHandler } from "./http/registerRequest.handler";
import { registerVerifyRoute } from "./http/registerVerify.route";
import { registerVerifyHandler } from "./http/registerVerify.handler";
import { loginRequestRoute } from "./http/loginRequest.route";
import { loginRequestHandler } from "./http/loginRequest.handler";
import { loginAttemptRoute } from "./http/loginAttempt.route";
import { loginAttemptHandler } from "./http/loginAttempt.handler";
import { authModeRoute } from "./http/mode.route";
import { authModeHandler } from "./http/mode.handler";
import { mcpUserinfoRoute } from "./http/mcpUserinfo.route";
import { mcpUserinfoHandler } from "./http/mcpUserinfo.handler";

export const authRouter = createRouter()
  .openapi(registerRequestRoute, registerRequestHandler)
  .openapi(registerVerifyRoute, registerVerifyHandler)
  .openapi(loginRequestRoute, loginRequestHandler)
  .openapi(loginAttemptRoute, loginAttemptHandler)
  .openapi(authModeRoute, authModeHandler)
  .openapi(mcpUserinfoRoute, mcpUserinfoHandler);
