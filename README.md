# apple-music-developer-token

[![npm](https://img.shields.io/npm/v/apple-music-developer-token.svg)](https://www.npmjs.com/package/apple-music-developer-token)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933.svg)](https://nodejs.org/)

Sign Apple Music **developer tokens** from your `.p8` key. A small library with a
matching CLI, ESM only.

A developer token is just an ES256 JWT signed with your MusicKit private key.
There is no network call and no user in the loop. Signing one should be the
boring part of talking to the Apple Music API, and this package keeps it that
way.

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

## Two tokens, and why this signs only one

Apple Music has two kinds of token, and mixing them up costs you an afternoon.
Here is the short version.

|                        | Developer token                                | Music user token                                                                                               |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Authorizes             | `/v1/catalog/...` (the public catalog)         | `/v1/me/...` (a person's library, recents, recommendations)                                                    |
| Identifies             | your developer account                         | one signed in listener                                                                                         |
| How you get it         | sign an ES256 JWT from your `.p8` key, offline | run MusicKit in a browser or on a device, have the listener authorize, then read the token MusicKit hands back |
| What this package does | **this**                                       | nothing                                                                                                        |

The developer token is the one you can make yourself. It identifies you and
authorizes the public catalog. You sign it offline from your `.p8` key, and that
is the entire job of this package.

The music user token is a different animal. It stands in for a person who has
signed in and authorized your app, and it cannot be signed at all; it only comes
back from an interactive MusicKit authorization. **This package does not create,
fetch, or refresh music user tokens.** If you are headed for `/v1/me/...`, a
developer token gets you to the door, not through it.

> This is the smaller of a pair. The companion project, a listening history
> fetcher, takes on the user token problem and leans on this package for the
> developer half. The companion essay is where I work through that distinction
> properly.

## Install

```sh
pnpm add apple-music-developer-token
```

Published on npm as
[`apple-music-developer-token`](https://www.npmjs.com/package/apple-music-developer-token).
Node 22 or newer, ESM only. There is no CommonJS build.

## Credentials

Three things, all from the [Apple Developer portal](https://developer.apple.com/account):

- The **MusicKit private key**, an `AuthKey_XXXXXXXXXX.p8` file you can download
  exactly once.
- Its **Key ID**: ten uppercase letters and digits.
- Your **Team ID**: also ten uppercase letters and digits.

The library checks the format of the Key ID and Team ID before it signs
anything. That sounds fussy until the first time Apple meets a malformed
credential with a bare `401` and no clue about which field is wrong. A local
error that names the offending value is cheap insurance.

### Storing the key as base64

A `.p8` is multi line PEM, and multi line secrets are a pain to carry through
shells, `.env` files, and CI without something mangling a newline. So encode the
whole file to a single base64 line and store that instead:

```sh
base64 -i AuthKey_ABC1234567.p8 | tr -d '\n'
```

```sh
# .env
APPLE_MUSIC_PRIVATE_KEY_BASE64=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0t...
APPLE_MUSIC_KEY_ID=ABC1234567
APPLE_MUSIC_TEAM_ID=DEF8901234
```

`pemFromBase64` turns that variable back into PEM. Paste the raw `.p8` contents
in by mistake and it tells you exactly that, instead of failing three steps
later with something cryptic. Note that the library never reads `process.env`
itself. You pass the credentials in, which is what keeps the signing code easy
to test and indifferent to where it runs. Reading the environment is your job.

## Library API

### `signDeveloperToken(options)`

Returns a `Promise<string>`, the signed ES256 JWT.

```ts
const token = await signDeveloperToken({
  privateKey, // PKCS8 PEM string (the .p8 contents)
  keyId, // 10 character Key ID
  teamId, // 10 character Team ID
  expiresIn: 600, // optional, seconds, default 600 (ten minutes)
});
```

The token puts your Key ID in the protected header as `kid` and carries three
claims and no more: `iss` (your Team ID), `iat`, and `exp`. That shape is the
whole contract Apple checks, and getting it slightly wrong is the usual reason
for a 401 that tells you nothing.

Tokens are short lived and signed fresh each time. Signing is cheap and offline,
so there is nothing to cache and no refresh logic to get wrong. The default
lifetime is ten minutes. The ceiling is `15777000` seconds, about six months,
and asking for more throws before anything gets signed.

### `pemFromBase64(value)`

Decodes a base64 encoded `.p8` into the PEM string `signDeveloperToken` wants.
Throws `InvalidPrivateKeyError` if you handed it raw PEM rather than base64, or
if the bytes decode to something that is not a PKCS8 key.

### `assertKeyId(keyId)` and `assertTeamId(teamId)`

Throw `InvalidKeyIdError` or `InvalidTeamIdError` when the value is not ten
uppercase letters and digits. `signDeveloperToken` already calls these; they are
exported for when you want the same check at your own boundary.

### Errors

Every error extends `AppleMusicTokenError`, so you can catch the whole family in
one place and still narrow to a specific one when you want a tailored message.

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

By default it prints the bare token, which pipes straight into whatever comes
next:

```sh
TOKEN=$(apple-music-developer-token --key-file AuthKey.p8 --key-id ABC1234567 --team-id DEF8901234)
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.music.apple.com/v1/catalog/us/charts?types=songs'
```

Add `--json` for the token plus its metadata. `expiresAt` is read back out of the
token's own `exp` claim, so it always matches what you actually signed:

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

The tests sign with a freshly generated ECDSA P-256 keypair, so nothing real
shaped ever lands in the repo. On the way to a release, `prepublishOnly` runs the
tests, the type check, the build, `publint`, and `@arethetypeswrong/cli`, so the
published `exports` map and the emitted types stay in sync.

## License

MIT, Anthony Liddle. See [LICENSE](./LICENSE).
