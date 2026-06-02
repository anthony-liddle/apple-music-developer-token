import { beforeAll, describe, expect, it } from 'vitest';
import { type CryptoKey, exportPKCS8, generateKeyPair, jwtVerify } from 'jose';
import { MAX_EXPIRES_IN_SECONDS, signDeveloperToken } from '@/sign.js';
import {
  InvalidExpiryError,
  InvalidKeyIdError,
  InvalidPrivateKeyError,
  InvalidTeamIdError,
} from '@/errors.js';

const KEY_ID = 'ABC1234567';
const TEAM_ID = 'DEF8901234';

let privateKeyPem: string;
let publicKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true });
  privateKeyPem = await exportPKCS8(pair.privateKey);
  publicKey = pair.publicKey;
});

describe('signDeveloperToken', () => {
  it('produces a token with the Key ID in the protected header and only iss/iat/exp claims', async () => {
    const token = await signDeveloperToken({
      privateKey: privateKeyPem,
      keyId: KEY_ID,
      teamId: TEAM_ID,
    });

    const { payload, protectedHeader } = await jwtVerify(token, publicKey);

    expect(protectedHeader.alg).toBe('ES256');
    expect(protectedHeader.kid).toBe(KEY_ID);
    expect(payload.iss).toBe(TEAM_ID);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
    // Apple expects exactly these claims. Extra claims are a silent failure.
    expect(payload.aud).toBeUndefined();
    expect(payload.sub).toBeUndefined();
  });

  it('defaults to a ten minute lifetime', async () => {
    const token = await signDeveloperToken({
      privateKey: privateKeyPem,
      keyId: KEY_ID,
      teamId: TEAM_ID,
    });

    const { payload } = await jwtVerify(token, publicKey);
    expect(payload.exp! - payload.iat!).toBe(600);
  });

  it('honors a custom expiresIn', async () => {
    const token = await signDeveloperToken({
      privateKey: privateKeyPem,
      keyId: KEY_ID,
      teamId: TEAM_ID,
      expiresIn: 3600,
    });

    const { payload } = await jwtVerify(token, publicKey);
    expect(payload.exp! - payload.iat!).toBe(3600);
  });

  it('rejects a malformed Key ID before touching the key', async () => {
    await expect(
      signDeveloperToken({
        privateKey: privateKeyPem,
        keyId: 'nope',
        teamId: TEAM_ID,
      }),
    ).rejects.toThrow(InvalidKeyIdError);
  });

  it('rejects a malformed Team ID', async () => {
    await expect(
      signDeveloperToken({
        privateKey: privateKeyPem,
        keyId: KEY_ID,
        teamId: 'nope',
      }),
    ).rejects.toThrow(InvalidTeamIdError);
  });

  it("rejects an expiry beyond Apple's documented maximum", async () => {
    await expect(
      signDeveloperToken({
        privateKey: privateKeyPem,
        keyId: KEY_ID,
        teamId: TEAM_ID,
        expiresIn: MAX_EXPIRES_IN_SECONDS + 1,
      }),
    ).rejects.toThrow(InvalidExpiryError);
  });

  it('rejects a non-positive expiry', async () => {
    await expect(
      signDeveloperToken({
        privateKey: privateKeyPem,
        keyId: KEY_ID,
        teamId: TEAM_ID,
        expiresIn: 0,
      }),
    ).rejects.toThrow(InvalidExpiryError);
  });

  it('rejects a fractional expiry', async () => {
    await expect(
      signDeveloperToken({
        privateKey: privateKeyPem,
        keyId: KEY_ID,
        teamId: TEAM_ID,
        expiresIn: 10.5,
      }),
    ).rejects.toThrow(InvalidExpiryError);
  });

  it('wraps an unreadable private key in InvalidPrivateKeyError', async () => {
    await expect(
      signDeveloperToken({
        privateKey: 'not a real pem',
        keyId: KEY_ID,
        teamId: TEAM_ID,
      }),
    ).rejects.toThrow(InvalidPrivateKeyError);
  });
});
