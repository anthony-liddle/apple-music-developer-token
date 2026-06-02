import { beforeAll, describe, expect, it } from 'vitest';
import { decodeJwt, exportPKCS8, generateKeyPair } from 'jose';
import { type CliIo, run } from '@/cli.js';

const KEY_ID = 'ABC1234567';
const TEAM_ID = 'DEF8901234';

let pem: string;
let base64: string;

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true });
  pem = await exportPKCS8(privateKey);
  base64 = Buffer.from(pem, 'utf8').toString('base64');
});

interface Captured {
  code: number;
  out: string;
  err: string;
}

async function invoke(
  argv: string[],
  files: Record<string, string> = {},
): Promise<Captured> {
  let out = '';
  let err = '';
  const io: CliIo = {
    stdout: (text) => {
      out += text;
    },
    stderr: (text) => {
      err += text;
    },
    readFile: async (path) => {
      const file = files[path];
      if (file === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }
      return file;
    },
  };
  const code = await run(argv, io);
  return { code, out, err };
}

describe('cli', () => {
  it('prints usage with --help and exits 0', async () => {
    const { code, out } = await invoke(['--help']);
    expect(code).toBe(0);
    expect(out).toContain('apple-music-developer-token');
    expect(out).toContain('--key-file');
    expect(out).toContain('--key-base64');
  });

  it('prints a version with --version and exits 0', async () => {
    const { code, out } = await invoke(['--version']);
    expect(code).toBe(0);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('signs a token from --key-base64', async () => {
    const { code, out } = await invoke([
      '--key-base64',
      base64,
      '--key-id',
      KEY_ID,
      '--team-id',
      TEAM_ID,
    ]);
    expect(code).toBe(0);
    expect(out.trim().split('.')).toHaveLength(3);
  });

  it('signs a token from --key-file', async () => {
    const { code, out } = await invoke(
      [
        '--key-file',
        '/keys/AuthKey.p8',
        '--key-id',
        KEY_ID,
        '--team-id',
        TEAM_ID,
      ],
      { '/keys/AuthKey.p8': pem },
    );
    expect(code).toBe(0);
    expect(out.trim().split('.')).toHaveLength(3);
  });

  it('emits structured output with --json', async () => {
    const { code, out } = await invoke([
      '--key-base64',
      base64,
      '--key-id',
      KEY_ID,
      '--team-id',
      TEAM_ID,
      '--expires-in',
      '900',
      '--json',
    ]);
    expect(code).toBe(0);
    const parsed = JSON.parse(out);
    expect(parsed.token.split('.')).toHaveLength(3);
    expect(parsed.keyId).toBe(KEY_ID);
    expect(parsed.teamId).toBe(TEAM_ID);
    expect(parsed.expiresIn).toBe(900);
    // expiresAt must reflect the token's own exp claim, not a separate clock
    // read, so the displayed expiry can never drift from the real one.
    const { exp } = decodeJwt(parsed.token);
    expect(parsed.expiresAt).toBe(new Date(exp! * 1000).toISOString());
  });

  it('detects a raw PEM pasted where base64 was expected', async () => {
    // The brief's headline failure mode, and the CLI is where a human pastes
    // a key, so the raw PEM hint has to win over the argument parser's own
    // less helpful error.
    const { code, err } = await invoke([
      '--key-base64',
      pem,
      '--key-id',
      KEY_ID,
      '--team-id',
      TEAM_ID,
    ]);
    expect(code).toBe(1);
    expect(err).toMatch(/raw PEM/i);
  });

  it('errors when no key source is given', async () => {
    const { code, err } = await invoke([
      '--key-id',
      KEY_ID,
      '--team-id',
      TEAM_ID,
    ]);
    expect(code).toBe(1);
    expect(err).toMatch(/--key-file|--key-base64/);
  });

  it('errors when both key sources are given', async () => {
    const { code, err } = await invoke(
      [
        '--key-file',
        '/keys/AuthKey.p8',
        '--key-base64',
        base64,
        '--key-id',
        KEY_ID,
        '--team-id',
        TEAM_ID,
      ],
      { '/keys/AuthKey.p8': pem },
    );
    expect(code).toBe(1);
    expect(err).toMatch(/only one|both/i);
  });

  it('surfaces a malformed Key ID as a readable error', async () => {
    const { code, err } = await invoke([
      '--key-base64',
      base64,
      '--key-id',
      'nope',
      '--team-id',
      TEAM_ID,
    ]);
    expect(code).toBe(1);
    expect(err).toMatch(/Key ID/);
  });

  it('errors on a non-numeric --expires-in', async () => {
    const { code, err } = await invoke([
      '--key-base64',
      base64,
      '--key-id',
      KEY_ID,
      '--team-id',
      TEAM_ID,
      '--expires-in',
      'soon',
    ]);
    expect(code).toBe(1);
    expect(err).toMatch(/expires-in/i);
  });
});
