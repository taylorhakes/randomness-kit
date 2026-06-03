import { CryptoSource } from "./crypto-source";
import { assertNonNegativeInteger, assertSafeInteger } from "./errors";
import type { RandomSource } from "./source";

/** `2^32` as an exact IEEE-754 double. Never derived via bit-shifting. */
const UINT32_RANGE = 2 ** 32;

/**
 * The largest number of distinct values {@link Random.int} can span: `2^53`
 * (`Number.MAX_SAFE_INTEGER + 1`). Above this, consecutive integers are no
 * longer exactly representable as IEEE-754 doubles, so uniformity could not be
 * guaranteed.
 */
const MAX_RANGE = 2 ** 53;

/** Default character set for {@link Random.string}: `A–Z a–z 0–9`. */
const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Number of bits needed to represent `x` (`0 <= x < 2^53`); `bitLength(0) === 0`.
 *
 * `Math.clz32` is an exact integer operation (no floating-point rounding, unlike
 * `Math.log2`), so the boundary at every power of two is precise. It only sees
 * 32 bits, so values that need more are split into a high and low word.
 */
function bitLength(x: number): number {
  return x < UINT32_RANGE
    ? 32 - Math.clz32(x) // fits in 32 bits; clz32(0) === 32 ⇒ bitLength(0) === 0
    : 32 + (32 - Math.clz32(Math.floor(x / UINT32_RANGE))); // high word (< 2^21)
}

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
   * Supports any span of up to `2^53` values across the safe-integer range,
   * including spans wider than `2^32`.
   *
   * @throws {TypeError} if `min` or `max` is not a safe integer.
   * @throws {RangeError} if `min > max` or the span exceeds `2^53` values.
   */
  int(min: number, max: number): number {
    assertSafeInteger(min, "min");
    assertSafeInteger(max, "max");
    if (min > max) {
      throw new RangeError(
        `randomness-kit: min (${min}) must be <= max (${max}).`,
      );
    }
    if (min === max) return min; // single value — no draw needed

    // `max - min` is exact for every span we accept (it is < 2^53, where all
    // integers are representable). Wider spans round, but they all fail this
    // guard regardless, so the comparison stays correct.
    if (max - min >= MAX_RANGE) {
      throw new RangeError(
        `randomness-kit: span (${max - min + 1}) exceeds the supported maximum of 2^53 values.`,
      );
    }

    return min + this.randbelow(max - min + 1); // range is 2..2^53, exact
  }

  /**
   * Uniform integer in `[0, n)` via bit-length rejection sampling (the
   * technique CPython's `random` uses): draw the fewest bits that cover `n`,
   * reject any draw `>= n`, and retry. Acceptance is always above 50%, and
   * only as many bits as the range needs are consumed.
   *
   * @param n range size, `2 <= n <= 2^53`.
   */
  private randbelow(n: number): number {
    const bits = bitLength(n - 1);
    let r: number;
    do {
      r = this.randomBits(bits);
    } while (r >= n);
    return r;
  }

  /**
   * Returns a uniformly random integer in `[0, 2^bits)` for `1 <= bits <= 53`.
   * One 32-bit word covers up to 32 bits; a second word supplies the rest.
   */
  private randomBits(bits: number): number {
    if (bits <= 32) {
      // Keep the top `bits` of one draw; for bits === 32 this is `>>> 0`, the
      // whole word. (Top bits, not bottom — high bits of a CSPRNG word are
      // exactly as uniform, and this avoids a mask constant.)
      return this.source.nextUint32() >>> (32 - bits);
    }
    // bits in 33..53: combine a full low word with the top `bits - 32` of a
    // high word. The product stays < 2^53, so it is an exact double.
    const low = this.source.nextUint32();
    const high = this.source.nextUint32() >>> (64 - bits);
    return high * UINT32_RANGE + low;
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
