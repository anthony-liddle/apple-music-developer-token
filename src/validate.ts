import { InvalidKeyIdError, InvalidTeamIdError } from '@/errors.js';

/**
 * Apple issues both Key IDs and Team IDs as exactly ten uppercase alphanumeric
 * characters. Validating that shape locally turns Apple's opaque 401 (which
 * never tells you which credential is wrong) into an error you can read.
 */
const APPLE_ID_PATTERN = /^[A-Z0-9]{10}$/;

export function assertKeyId(keyId: string): void {
  if (!APPLE_ID_PATTERN.test(keyId)) {
    throw new InvalidKeyIdError(
      `Invalid Key ID ${JSON.stringify(keyId)}. ` +
        'Expected ten uppercase alphanumeric characters, ' +
        'for example "ABC1234567". Find it in the Apple Developer portal ' +
        'under Certificates, Identifiers & Profiles, Keys.',
    );
  }
}

export function assertTeamId(teamId: string): void {
  if (!APPLE_ID_PATTERN.test(teamId)) {
    throw new InvalidTeamIdError(
      `Invalid Team ID ${JSON.stringify(teamId)}. ` +
        'Expected ten uppercase alphanumeric characters, ' +
        'for example "DEF8901234". Find it in the top right of the ' +
        'Apple Developer portal, or under Membership details.',
    );
  }
}
