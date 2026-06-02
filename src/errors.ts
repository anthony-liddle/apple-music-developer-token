/**
 * All errors thrown by this library extend AppleMusicTokenError, so callers can
 * catch the whole family with one `instanceof` check and still narrow to a
 * specific subclass when they want a tailored message.
 */
export class AppleMusicTokenError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    // Give each subclass its own name without repeating boilerplate. Without
    // this, `error.name` would read "Error" for every subclass.
    this.name = this.constructor.name;
  }
}

export class InvalidKeyIdError extends AppleMusicTokenError {}

export class InvalidTeamIdError extends AppleMusicTokenError {}

export class InvalidPrivateKeyError extends AppleMusicTokenError {}

export class InvalidExpiryError extends AppleMusicTokenError {}
