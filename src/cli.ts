#!/usr/bin/env node
import { readFile as fsReadFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { decodeJwt } from 'jose';
import { pemFromBase64 } from '@/pem.js';
import { DEFAULT_EXPIRES_IN_SECONDS, signDeveloperToken } from '@/sign.js';
import { AppleMusicTokenError } from '@/errors.js';

/**
 * Everything the CLI touches in the outside world, gathered behind one object
 * so the core logic stays pure. Tests pass fakes; the real entrypoint passes
 * the real thing. This is the same hermetic stance the library takes.
 */
export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  readFile: (path: string) => Promise<string>;
}

const USAGE = `apple-music-developer-token

Sign a short lived Apple Music API developer token (an ES256 JWT) for the
catalog endpoints under /v1/catalog/.

Usage:
  apple-music-developer-token --key-file <path> --key-id <id> --team-id <id>
  apple-music-developer-token --key-base64 <value> --key-id <id> --team-id <id>

Key source (exactly one required):
  --key-file <path>      Path to your .p8 private key file.
  --key-base64 <value>   The .p8 file, base64 encoded.

Required:
  --key-id <id>          The 10 character Key ID.
  --team-id <id>         The 10 character Team ID.

Options:
  --expires-in <seconds> Token lifetime in seconds (default ${DEFAULT_EXPIRES_IN_SECONDS}).
  --json                 Print token plus metadata as JSON.
  -h, --help             Show this help.
  -v, --version          Show the version.
`;

/**
 * Runs the CLI and returns a process exit code. It never calls process.exit or
 * reads process.argv itself, which is what keeps it testable.
 */
export async function run(argv: string[], io: CliIo): Promise<number> {
  // A raw PEM pasted as a flag value starts with a dash, which the argument
  // parser rejects with an unhelpful "ambiguous argument" error before the key
  // handling ever runs. Since this is the most likely mistake a human makes at
  // the prompt, catch it first and reuse the library's hint.
  const rawPemArg = argv.find((arg) => arg.includes('PRIVATE KEY'));
  if (rawPemArg !== undefined) {
    try {
      pemFromBase64(rawPemArg);
    } catch (error) {
      io.stderr(`${messageOf(error)}\n`);
      return 1;
    }
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        'key-file': { type: 'string' },
        'key-base64': { type: 'string' },
        'key-id': { type: 'string' },
        'team-id': { type: 'string' },
        'expires-in': { type: 'string' },
        json: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
      allowPositionals: false,
    });
  } catch (error) {
    io.stderr(`${messageOf(error)}\n`);
    return 1;
  }

  const { values } = parsed;

  if (values.help) {
    io.stdout(USAGE);
    return 0;
  }

  if (values.version) {
    io.stdout(`${readVersion()}\n`);
    return 0;
  }

  try {
    const privateKey = await resolvePrivateKey(values, io);
    const expiresIn = parseExpiresIn(values['expires-in']);

    const keyId = required(values['key-id'], '--key-id');
    const teamId = required(values['team-id'], '--team-id');

    const token = await signDeveloperToken({
      privateKey,
      keyId,
      teamId,
      expiresIn,
    });

    if (values.json) {
      // Read the expiry back from the token itself rather than the clock, so
      // the reported expiresAt can never drift from the signed exp claim.
      const { exp } = decodeJwt(token);
      const expiresAt = new Date(exp! * 1000).toISOString();
      io.stdout(
        `${JSON.stringify(
          { token, keyId, teamId, expiresIn, expiresAt },
          null,
          2,
        )}\n`,
      );
    } else {
      io.stdout(`${token}\n`);
    }

    return 0;
  } catch (error) {
    io.stderr(`${messageOf(error)}\n`);
    return 1;
  }
}

async function resolvePrivateKey(
  values: { 'key-file'?: string; 'key-base64'?: string },
  io: CliIo,
): Promise<string> {
  const keyFile = values['key-file'];
  const keyBase64 = values['key-base64'];

  if (keyFile !== undefined && keyBase64 !== undefined) {
    throw new CliError(
      'Pass only one key source: either --key-file or --key-base64, not both.',
    );
  }

  if (keyFile !== undefined) {
    try {
      return await io.readFile(keyFile);
    } catch (cause) {
      throw new CliError(
        `Could not read key file ${JSON.stringify(keyFile)}.`,
        { cause },
      );
    }
  }

  if (keyBase64 !== undefined) {
    return pemFromBase64(keyBase64);
  }

  throw new CliError(
    'A key source is required: pass --key-file <path> or --key-base64 <value>.',
  );
}

function parseExpiresIn(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_EXPIRES_IN_SECONDS;
  }
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new CliError(
      `Invalid --expires-in ${JSON.stringify(raw)}. ` +
        'Expected a whole number of seconds.',
    );
  }
  return value;
}

function required(value: string | undefined, flag: string): string {
  if (value === undefined) {
    throw new CliError(`Missing required option ${flag}.`);
  }
  return value;
}

/** A CLI level error whose message is safe to print as is. */
class CliError extends Error {}

function messageOf(error: unknown): string {
  if (error instanceof CliError || error instanceof AppleMusicTokenError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function readVersion(): string {
  // Resolved relative to this module, so it works from src during tests and
  // from dist once built and published. package.json sits one level above both.
  const require = createRequire(import.meta.url);
  const pkg = require('../package.json') as { version: string };
  return pkg.version;
}

// Run only when invoked as the executable, not when imported by tests.
const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  run(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    readFile: (path) => fsReadFile(path, 'utf8'),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`${messageOf(error)}\n`);
      process.exitCode = 1;
    },
  );
}
