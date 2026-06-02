/**
 * apple-music-developer-token
 *
 * Sign short lived Apple Music API developer tokens (ES256 JWTs) from a .p8
 * private key. The developer token authorizes the catalog endpoints under
 * `/v1/catalog/...`. It is not a music user token, which authorizes `/v1/me/...`
 * and has its own separate flow. See the README for that distinction.
 */
export {
  signDeveloperToken,
  type SignDeveloperTokenOptions,
  DEFAULT_EXPIRES_IN_SECONDS,
  MAX_EXPIRES_IN_SECONDS,
} from '@/sign.js';

export { pemFromBase64 } from '@/pem.js';

export { assertKeyId, assertTeamId } from '@/validate.js';

export {
  AppleMusicTokenError,
  InvalidKeyIdError,
  InvalidTeamIdError,
  InvalidPrivateKeyError,
  InvalidExpiryError,
} from '@/errors.js';
