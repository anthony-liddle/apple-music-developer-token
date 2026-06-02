import { describe, expect, it } from 'vitest';
import { assertKeyId, assertTeamId } from '@/validate.js';
import { InvalidKeyIdError, InvalidTeamIdError } from '@/errors.js';

describe('assertKeyId', () => {
  it('accepts a well formed Key ID', () => {
    expect(() => assertKeyId('ABC1234567')).not.toThrow();
  });

  it('rejects a Key ID that is too short', () => {
    expect(() => assertKeyId('ABC123')).toThrow(InvalidKeyIdError);
  });

  it('rejects a Key ID with lowercase letters', () => {
    expect(() => assertKeyId('abc1234567')).toThrow(InvalidKeyIdError);
  });

  it('names the field and shows the offending value in the message', () => {
    expect(() => assertKeyId('nope')).toThrow(/Key ID/);
    expect(() => assertKeyId('nope')).toThrow(/nope/);
  });
});

describe('assertTeamId', () => {
  it('accepts a well formed Team ID', () => {
    expect(() => assertTeamId('DEF8901234')).not.toThrow();
  });

  it('rejects a Team ID with punctuation', () => {
    expect(() => assertTeamId('DEF890123!')).toThrow(InvalidTeamIdError);
  });

  it('names the field in the message', () => {
    expect(() => assertTeamId('')).toThrow(/Team ID/);
  });
});
