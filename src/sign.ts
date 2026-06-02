import { importPKCS8, SignJWT } from 'jose';
import { assertKeyId, assertTeamId } from '@/validate.js';
import { InvalidExpiryError, InvalidPrivateKeyError } from '@/errors.js';

/**
 * Apple documents the maximum developer token lifetime as 15,777,000 seconds,
 * roughly six months. Requesting more is rejected at the API, so we reject it
 * here with a message you can read instead.
 */
export const MAX_EXPIRES_IN_SECONDS = 15_777_000;

/**
 * Ten minutes. Signing is cheap, deterministic, and offline, so the right
 * default is a short lived token signed fresh per use rather than a long lived
 * one held in memory. See the README on why this library does not cache.
 */
export const DEFAULT_EXPIRES_IN_SECONDS = 600;

/** Apple Music developer tokens are always ES256. */
const ALGORITHM = 'ES256';

export interface SignDeveloperTokenOptions {
  /**
   * The .p8 private key as a PKCS8 PEM string. Read it from a file, or decode
   * it from a base64 environment variable with `pemFromBase64`.
   */
  privateKey: string;
  /** The 10 character Key ID for the key above. */
  keyId: string;
  /** The 10 character Team ID for your Apple Developer account. */
  teamId: string;
  /**
   * Token lifetime in seconds. Defaults to ten minutes. Capped at Apple's
   * documented maximum of {@link MAX_EXPIRES_IN_SECONDS}.
   */
  expiresIn?: number;
}

/**
 * Signs an Apple Music API developer token: an ES256 JWT that authorizes the
 * catalog endpoints under `/v1/catalog/...`.
 *
 * Credentials are passed in, never read from the environment, so the function
 * stays hermetic, testable, and agnostic about where you run it.
 *
 * The token carries the Key ID in its protected header (as `kid`) and exactly
 * three claims: `iss` (your Team ID), `iat`, and `exp`. That shape is the whole
 * contract; Apple returns an unhelpful 401 when any of it is wrong, which is
 * the friction this function exists to remove.
 */
export async function signDeveloperToken(
  options: SignDeveloperTokenOptions,
): Promise<string> {
  const { privateKey, keyId, teamId } = options;
  const expiresIn = options.expiresIn ?? DEFAULT_EXPIRES_IN_SECONDS;

  // Validate the cheap, local things first so a typo in an ID never reaches
  // Apple as an inscrutable 401.
  assertKeyId(keyId);
  assertTeamId(teamId);
  assertExpiresIn(expiresIn);

  const key = await importKey(privateKey);

  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM, kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + expiresIn)
    .sign(key);
}

function assertExpiresIn(expiresIn: number): void {
  if (!Number.isInteger(expiresIn) || expiresIn <= 0) {
    throw new InvalidExpiryError(
      `Invalid expiresIn ${JSON.stringify(expiresIn)}. ` +
        'Expected a positive whole number of seconds.',
    );
  }
  if (expiresIn > MAX_EXPIRES_IN_SECONDS) {
    throw new InvalidExpiryError(
      `expiresIn of ${expiresIn} seconds exceeds Apple's maximum of ` +
        `${MAX_EXPIRES_IN_SECONDS} seconds (about six months).`,
    );
  }
}

async function importKey(privateKey: string) {
  try {
    return await importPKCS8(privateKey, ALGORITHM);
  } catch (cause) {
    // jose's own message ("Failed to read private key...") does not mention the
    // .p8 origin or the base64 helper, so we add that context here.
    throw new InvalidPrivateKeyError(
      'Could not read the private key as a PKCS8 PEM. ' +
        'Expected the contents of your .p8 file. If it is stored as a base64 ' +
        'environment variable, decode it with pemFromBase64 first.',
      { cause },
    );
  }
}
