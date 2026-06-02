import { InvalidPrivateKeyError } from '@/errors.js';

const PEM_HEADER = '-----BEGIN';
const PKCS8_HEADER = '-----BEGIN PRIVATE KEY-----';

/**
 * Decodes a base64 encoded .p8 key into the PEM string the signer expects.
 *
 * The .p8 file Apple gives you is already PEM. The convention this library
 * follows is to base64 encode that whole file and store the result in a single
 * environment variable, which sidesteps the newline handling problems that
 * plague multi-line secrets in shells, CI, and .env files.
 *
 * The error paths matter more than the happy path here, because this is where
 * a misconfigured environment surfaces. The two failures worth distinguishing:
 * pasting the raw PEM (the common one), and base64 that decodes to anything
 * other than a PKCS8 key.
 */
export function pemFromBase64(value: string): string {
  // Catch the raw PEM paste before decoding. If the input already contains a
  // PEM header, the caller skipped the base64 step, and decoding it would
  // produce nonsense with a confusing downstream error.
  if (value.includes(PEM_HEADER)) {
    throw new InvalidPrivateKeyError(
      'The private key looks like raw PEM, not base64. ' +
        'This variable expects the .p8 file base64 encoded, not its ' +
        'contents pasted directly. Encode it first, for example: ' +
        'base64 -i AuthKey_ABC1234567.p8 | tr -d "\\n"',
    );
  }

  // Node ignores whitespace and non base64 characters while decoding, so we
  // judge validity by what comes out rather than what went in.
  const decoded = Buffer.from(value, 'base64').toString('utf8');

  if (!decoded.includes(PKCS8_HEADER)) {
    throw new InvalidPrivateKeyError(
      'The base64 value did not decode to a PKCS8 private key. ' +
        `Expected the decoded text to contain "${PKCS8_HEADER}". ` +
        'Check that you base64 encoded the .p8 file and copied all of it.',
    );
  }

  return decoded.trim();
}
