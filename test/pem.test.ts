import { beforeAll, describe, expect, it } from 'vitest';
import { exportPKCS8, generateKeyPair } from 'jose';
import { pemFromBase64 } from '@/pem.js';
import { InvalidPrivateKeyError } from '@/errors.js';

let pem: string;
let base64: string;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  pem = await exportPKCS8(privateKey);
  base64 = Buffer.from(pem, 'utf8').toString('base64');
});

describe('pemFromBase64', () => {
  it('round trips a base64 encoded PKCS8 key back to PEM', () => {
    expect(pemFromBase64(base64)).toBe(pem.trim());
  });

  it('tolerates surrounding whitespace and newlines in the base64', () => {
    const wrapped = `\n  ${base64.slice(0, 40)}\n${base64.slice(40)}  \n`;
    expect(pemFromBase64(wrapped)).toBe(pem.trim());
  });

  it('names the raw PEM mistake specifically', () => {
    expect(() => pemFromBase64(pem)).toThrow(InvalidPrivateKeyError);
    // The single most likely real-world error: pasting the .p8 contents
    // directly instead of base64 encoding them first.
    expect(() => pemFromBase64(pem)).toThrow(/base64/i);
  });

  it('rejects base64 that decodes to something that is not a PEM key', () => {
    const garbage = Buffer.from('this is not a key', 'utf8').toString('base64');
    expect(() => pemFromBase64(garbage)).toThrow(InvalidPrivateKeyError);
  });

  it('rejects an empty value', () => {
    expect(() => pemFromBase64('')).toThrow(InvalidPrivateKeyError);
  });
});
