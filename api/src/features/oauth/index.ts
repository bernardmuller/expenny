export { registerRoute as oauthRegisterRoute } from "./http/register.route";
export {
  registerOAuthClientHandler as oauthRegisterClientHandler,
} from "./http/register.handler";
export { tokenRoute as oauthTokenRoute } from "./http/token.route";
export { oauthTokenHandler } from "./http/token.handler";
export { metadataRoute as oauthMetadataRoute } from "./http/metadata.route";
export { oauthMetadataHandler } from "./http/metadata.handler";