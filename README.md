# apple-music-developer-token

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933.svg)](https://nodejs.org/)

Sign short lived Apple Music API **developer tokens** (ES256 JWTs) from a `.p8`
private key. Library plus a small CLI, one package, ESM only.

```ts
import { signDeveloperToken, pemFromBase64 } from 'apple-music-developer-token';

const token = await signDeveloperToken({
  privateKey: pemFromBase64(process.env.APPLE_MUSIC_PRIVATE_KEY_BASE64!),
  keyId: process.env.APPLE_MUSIC_KEY_ID!,
  teamId: process.env.APPLE_MUSIC_TEAM_ID!,
});

const res = await fetch(
  'https://api.music.apple.com/v1/catalog/us/songs/203709340',
  {
    headers: { Authorization: `Bearer ${token}` },
  },
);
```

## What this signs, and what it does not

Apple Music has two tokens, and they are not interchangeable. This package
mints the first one only.

|                        | Developer token                                | Music user token                                                                                               |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Authorizes             | `/v1/catalog/...` (the public catalog)         | `/v1/me/...` (a person's library, recents, recommendations)                                                    |
| Identifies             | your developer account                         | one signed in listener                                                                                         |
| How you get it         | sign an ES256 JWT from your `.p8` key, offline | run MusicKit in a browser or on a device, have the listener authorize, then read the token MusicKit hands back |
| What this package does | **this**                                       | nothing                                                                                                        |

The developer token is the easy half. It is a JWT you can sign anywhere, with no
network call and no user involved. That is the whole job of this package.

The music user token is the hard half. It cannot be signed offline; it only
comes out of an interactive MusicKit authorization, and routing around that
friction is a separate problem with its own moving parts. **This package does
not create, fetch, or refresh music user tokens.** If you need `/v1/me/...`
access, the developer token here is a prerequisite, not the finish line.

> This package is the smaller of a pair. The companion project, a listening
> history fetcher, takes on the user token problem and depends on this one for
> the developer token. The companion essay covers that distinction in depth.

## Install

```sh
pnpm add apple-music-developer-token
```

Node 22 or newer. ESM only; there is no CommonJS build.

## Credentials

You need three things from the [Apple Developer portal](https://developer.apple.com/account):

- A **MusicKit private key**, downloaded once as an `AuthKey_XXXXXXXXXX.p8` file.
- The **Key ID** for that key: ten uppercase alphanumeric characters.
- Your **Team ID**: also ten uppercase alphanumeric characters.

This library validates the Key ID and Team ID format locally before signing,
because Apple answers a malformed credential with a bare `401` that never says
which field is wrong. A local error that names the field saves the guessing.

### Storing the key as base64

The convention this package follows is to base64 encode the whole `.p8` file and
keep the result in a single environment variable. One line, no embedded
newlines, which sidesteps the quoting and newline problems that multi-line
secrets cause in shells, `.env` files, and CI.

```sh
base64 -i AuthKey_ABC1234567.p8 | tr -d '\n'
```

```sh
# .env
APPLE_MUSIC_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t...
APPLE_MUSIC_KEY_ID=ABC1234567
APPLE_MUSIC_TEAM_ID=DEF8901234
```

`pemFromBase64` decodes that variable back to PEM and, if you accidentally store
the raw `.p8` contents instead of the base64, tells you so by name. The library
itself never reads `process.env`; you pass credentials in, which keeps it
hermetic and testable. Reading the environment is the caller's job.

## Library API

### `signDeveloperToken(options)`

Returns a `Promise<string>`: a signed ES256 JWT.

```ts
const token = await signDeveloperToken({
  privateKey, // PKCS8 PEM string (the .p8 contents)
  keyId, // 10 character Key ID
  teamId, // 10 character Team ID
  expiresIn: 600, // optional, seconds, default 600 (ten minutes)
});
```

The token carries the Key ID in its protected header as `kid`, and exactly three
claims: `iss` (your Team ID), `iat`, and `exp`. That shape is the entire
contract Apple checks.

Tokens are short lived and signed fresh per use. Signing is cheap, deterministic,
and offline, so there is no caching or reuse logic to get wrong. The default is
ten minutes; the maximum Apple accepts is `15777000` seconds (about six months),
and asking for more throws before any signing happens.

### `pemFromBase64(value)`

Decodes a base64 encoded `.p8` into the PEM string `signDeveloperToken` expects.
Throws `InvalidPrivateKeyError` if the value is raw PEM rather than base64, or if
it decodes to something other than a PKCS8 key.

### `assertKeyId(keyId)` and `assertTeamId(teamId)`

Throw `InvalidKeyIdError` or `InvalidTeamIdError` if the value is not ten
uppercase alphanumeric characters. `signDeveloperToken` calls these for you;
they are exported for validating input at your own boundary.

### Errors

Every error extends `AppleMusicTokenError`, so you can catch the family with one
check and still narrow when you want a tailored message.

```ts
import { AppleMusicTokenError } from 'apple-music-developer-token';

try {
  await signDeveloperToken(/* ... */);
} catch (error) {
  if (error instanceof AppleMusicTokenError) {
    // InvalidKeyIdError | InvalidTeamIdError
    // | InvalidPrivateKeyError | InvalidExpiryError
  }
}
```

## CLI

The binary name matches the package name.

```sh
# From a key file
apple-music-developer-token \
  --key-file AuthKey_ABC1234567.p8 \
  --key-id ABC1234567 \
  --team-id DEF8901234

# From a base64 environment variable
apple-music-developer-token \
  --key-base64 "$APPLE_MUSIC_PRIVATE_KEY_BASE64" \
  --key-id "$APPLE_MUSIC_KEY_ID" \
  --team-id "$APPLE_MUSIC_TEAM_ID"
```

By default it prints the bare token, which pipes cleanly into other tools:

```sh
TOKEN=$(apple-music-developer-token --key-file AuthKey.p8 --key-id ABC1234567 --team-id DEF8901234)
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.music.apple.com/v1/catalog/us/charts?types=songs'
```

`--json` prints the token alongside its metadata, with `expiresAt` read back from
the token's own `exp` claim so it always matches:

```sh
apple-music-developer-token --key-file AuthKey.p8 --key-id ABC1234567 --team-id DEF8901234 --json
```

```json
{
  "token": "eyJhbGciOiJFUzI1NiIsImtpZCI6...",
  "keyId": "ABC1234567",
  "teamId": "DEF8901234",
  "expiresIn": 600,
  "expiresAt": "2026-06-02T18:16:45.000Z"
}
```

| Flag                     | Description                              |
| ------------------------ | ---------------------------------------- |
| `--key-file <path>`      | Path to the `.p8` private key file.      |
| `--key-base64 <value>`   | The `.p8` file, base64 encoded.          |
| `--key-id <id>`          | The 10 character Key ID (required).      |
| `--team-id <id>`         | The 10 character Team ID (required).     |
| `--expires-in <seconds>` | Token lifetime in seconds (default 600). |
| `--json`                 | Print token plus metadata as JSON.       |
| `-h`, `--help`           | Show help.                               |
| `-v`, `--version`        | Show the version.                        |

Pass exactly one of `--key-file` or `--key-base64`.

## Development

```sh
pnpm install
pnpm test        # vitest
pnpm typecheck   # tsc --noEmit
pnpm build       # tsdown, emits dist/
pnpm lint        # eslint
pnpm format      # prettier --write
```

Tests use a freshly generated ECDSA P-256 keypair, so no real credentials live
in the repository. Before publishing, `prepublishOnly` runs the tests, the type
check, the build, `publint`, and `@arethetypeswrong/cli` so the published
package's `exports` map and emitted types cannot drift out of sync.

## License

MIT, Anthony Liddle. See [LICENSE](./LICENSE).
