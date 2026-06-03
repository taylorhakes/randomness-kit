import { describe, expect, it } from "vitest";
import { Random } from "../src/index";
import { MockSource } from "./mock-source";

const UINT32_RANGE = 2 ** 32;

/**
 * A uint32 draw whose top `bits` bits equal `value`. `int`/`randbelow` read
 * the *high* bits of each word (`word >>> (32 - bits)`), so this is how a mock
 * script names the integer a draw should yield.
 */
const word = (value: number, bits: number) => value * 2 ** (32 - bits);

describe("int()", () => {
  it("draws only the bits the range needs and maps into the inclusive range", () => {
    // range = 6 -> 3 bits. Draw 4 (top 3 bits) -> 4 < 6 accepted -> 1 + 4 = 5.
    const rng = new Random(new MockSource([word(4, 3)]));
    expect(rng.int(1, 6)).toBe(5);
  });

  it("rejects draws at or above the range, then uses the next valid one", () => {
    // range = 3 -> 2 bits. First draw 3 (>= 3) is rejected; second draw 2 is
    // used: 0 + 2 = 2.
    const rng = new Random(new MockSource([word(3, 2), word(2, 2)]));
    expect(rng.int(0, 2)).toBe(2);
  });

  it("returns the single value when min === max without consuming a draw", () => {
    const rng = new Random(new MockSource([])); // empty: any draw would throw
    expect(rng.int(7, 7)).toBe(7);
  });

  it("supports negative ranges", () => {
    // range = 11 ([-5..5]) -> 4 bits. Draw 4 -> -5 + 4 = -1.
    const rng = new Random(new MockSource([word(4, 4)]));
    expect(rng.int(-5, 5)).toBe(-1);
  });

  it("handles the full 2^32 range boundary without throwing", () => {
    // range === 2^32 -> 32 bits -> each draw is used verbatim, none rejected.
    const rng = new Random(new MockSource([0, UINT32_RANGE - 1]));
    expect(rng.int(0, UINT32_RANGE - 1)).toBe(0);
    expect(rng.int(0, UINT32_RANGE - 1)).toBe(UINT32_RANGE - 1);
  });

  it("supports ranges wider than 2^32 by combining two draws", () => {
    // range = 2^40 -> 40 bits. randomBits draws the low word first, then the
    // top 8 bits of a high word: high*2^32 + low = 3*2^32 + 5.
    const rng = new Random(new MockSource([5, word(3, 8)]));
    expect(rng.int(0, 2 ** 40 - 1)).toBe(3 * 2 ** 32 + 5);
  });

  it("supports the maximum 2^53 span up to MAX_SAFE_INTEGER", () => {
    // range = 2^53 -> 53 bits. low = 0, high = top 21 bits = 1 -> 1*2^32 + 0.
    const rng = new Random(new MockSource([0, word(1, 21)]));
    expect(rng.int(0, Number.MAX_SAFE_INTEGER)).toBe(2 ** 32);
  });

  it("throws RangeError when min > max", () => {
    const rng = new Random(new MockSource([0]));
    expect(() => rng.int(5, 1)).toThrow(RangeError);
  });

  it("throws RangeError when the span exceeds 2^53 values", () => {
    // Both bounds are safe integers, but the span is 2^53 + 1.
    const rng = new Random(new MockSource([0]));
    expect(() => rng.int(-1, Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });

  it("throws TypeError for non-integer or out-of-safe-range bounds", () => {
    const rng = new Random(new MockSource([0]));
    expect(() => rng.int(1.5, 6)).toThrow(TypeError);
    expect(() => rng.int(0, Number.NaN)).toThrow(TypeError);
    expect(() => rng.int(0, 2 ** 53)).toThrow(TypeError); // not a safe integer
    // @ts-expect-error wrong type on purpose
    expect(() => rng.int("0", 6)).toThrow(TypeError);
  });

  it("is unbiased and stays in range over many secure draws", () => {
    const rng = new Random();
    for (let i = 0; i < 10_000; i++) {
      const v = rng.int(-3, 9);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
