import { Random } from "./random";

export { Random } from "./random";
export { CryptoSource } from "./crypto-source";
export type { RandomSource } from "./source";

/**
 * Creates a secure, crypto-backed {@link Random} instance.
 *
 * @example
 * ```ts
 * import { random } from "randomness-kit";
 *
 * const rng = random();
 * rng.bytes(16);          // Uint8Array(16)
 * rng.int(1, 6);          // dice roll, inclusive
 * rng.string(12);         // alphanumeric token
 * ```
 */
export function random(): Random {
  return new Random();
}
