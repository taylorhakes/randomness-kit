import { CryptoSource } from "./crypto-source";
import { assertNonNegativeInteger, assertSafeInteger } from "./errors";
import type { RandomSource } from "./source";

/** `2^32` as an exact IEEE-754 double. Never derived via bit-shifting. */
const UINT32_RANGE = 2 ** 32;

/** Default character set for {@link Random.string}: `A–Z a–z 0–9`. */
const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Ergonomic randomness API. Shapes raw bits from a {@link RandomSource} into
 * bytes, integers, floats, booleans, strings, and element picks.
 *
 * Construct via the {@link random} factory for the secure default, or pass a
 * custom source (e.g. a deterministic mock in tests).
 */
export class Random {
  private readonly source: RandomSource;

  /**
   * @param source The entropy source. Defaults to a secure {@link CryptoSource}.
   */
  constructor(source: RandomSource = new CryptoSource()) {
    this.source = source;
  }

  /**
   * Returns `length` random bytes.
   *
   * Note: each call is self-contained — `bytes(1)` four times does not equal
   * `bytes(4)`.
   *
   * @throws {TypeError} if `length` is not an integer.
   * @throws {RangeError} if `length` is negative.
   */
  bytes(length: number): Uint8Array {
    assertNonNegativeInteger(length, "length");
    const buffer = new Uint8Array(length);
    this.source.fillBytes(buffer);
    return buffer;
  }

  /**
   * Returns a uniformly distributed integer in the inclusive range
   * `[min, max]`, free of modulo bias (via rejection sampling).
   *
   * @throws {TypeError} if `min` or `max` is not a safe integer.
   * @throws {RangeError} if `min > max` or the range exceeds `2^32`.
   */
  int(min: number, max: number): number {
    assertSafeInteger(min, "min");
    assertSafeInteger(max, "max");
    if (min > max) {
      throw new RangeError(
        `randomness-kit: min (${min}) must be <= max (${max}).`,
      );
    }

    // All arithmetic stays in doubles (exact <= 2^53); `range` is never
    // bit-coerced, which would wrap 2^32 to 0.
    const range = max - min + 1;
    if (range > UINT32_RANGE) {
      throw new RangeError(
        `randomness-kit: range (${range}) exceeds the supported maximum of 2^32.`,
      );
    }

    // Largest multiple of `range` that fits in a uint32; reject above it to
    // remove modulo bias. When range === 2^32, threshold === 2^32 and every
    // draw is accepted.
    const threshold = UINT32_RANGE - (UINT32_RANGE % range);
    let r: number;
    do {
      r = this.source.nextUint32();
    } while (r >= threshold);

    return min + (r % range);
  }

  /**
   * Returns a float in `[0, 1)` with full 53-bit precision (the precision of a
   * JavaScript double), combining two 32-bit draws.
   */
  float(): number {
    const hi = this.source.nextUint32() >>> 5; // top 27 bits
    const lo = this.source.nextUint32() >>> 6; // top 26 bits
    return (hi * 2 ** 26 + lo) / 2 ** 53;
  }

  /**
   * Returns `true` with probability `p` (default `0.5`).
   *
   * @throws {TypeError} if `p` is not a finite number.
   * @throws {RangeError} if `p` is outside `[0, 1]`.
   */
  bool(p = 0.5): boolean {
    if (typeof p !== "number" || !Number.isFinite(p)) {
      throw new TypeError(`randomness-kit: p must be a finite number.`);
    }
    if (p < 0 || p > 1) {
      throw new RangeError(`randomness-kit: p (${p}) must be within [0, 1].`);
    }
    if (p === 0) return false;
    if (p === 1) return true;
    return this.float() < p;
  }

  /**
   * Returns a random string of `length` characters drawn uniformly from
   * `charset` (default `A–Z a–z 0–9`). The charset is iterated by Unicode code
   * point, so multi-byte characters and emoji are never split.
   *
   * @throws {TypeError} if `length` is not an integer or `charset` is empty/not a string.
   * @throws {RangeError} if `length` is negative.
   */
  string(length: number, charset: string = DEFAULT_CHARSET): string {
    assertNonNegativeInteger(length, "length");
    if (typeof charset !== "string") {
      throw new TypeError("randomness-kit: charset must be a string.");
    }
    const chars = Array.from(charset); // split by code point, not UTF-16 unit
    if (chars.length === 0) {
      throw new TypeError("randomness-kit: charset must not be empty.");
    }
    if (length === 0) return "";

    const maxIndex = chars.length - 1;
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[this.int(0, maxIndex)];
    }
    return result;
  }

  /**
   * Returns a uniformly chosen element from `items`.
   *
   * @throws {TypeError} if `items` is not an array.
   * @throws {RangeError} if `items` is empty.
   */
  pick<T>(items: readonly T[]): T {
    if (!Array.isArray(items)) {
      throw new TypeError("randomness-kit: pick requires an array.");
    }
    if (items.length === 0) {
      throw new RangeError("randomness-kit: cannot pick from an empty array.");
    }
    return items[this.int(0, items.length - 1)] as T;
  }
}
