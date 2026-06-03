import { describe, expect, it } from "vitest";
import { Random } from "../src/index";
import { MockSource } from "./mock-source";

const UINT32_RANGE = 2 ** 32;

describe("int()", () => {
  it("maps a uint32 draw into the inclusive range via modulo", () => {
    // range = 6, threshold = 4294967292. Draw 10 -> 10 % 6 = 4 -> 1 + 4 = 5.
    const rng = new Random(new MockSource([10]));
    expect(rng.int(1, 6)).toBe(5);
  });

  it("rejects draws at or above the threshold, then uses the next valid one", () => {
    // range = 3, threshold = 4294967295 (= 2^32 - 1). First draw equals the
    // threshold and must be rejected; second draw (5) is used: 5 % 3 = 2.
    const rng = new Random(new MockSource([UINT32_RANGE - 1, 5]));
    expect(rng.int(0, 2)).toBe(2);
  });

  it("returns the single value when min === max without consuming bias budget", () => {
    const rng = new Random(new MockSource([0]));
    expect(rng.int(7, 7)).toBe(7);
  });

  it("supports negative ranges", () => {
    const rng = new Random(new MockSource([4]));
    // range = 11 ([-5..5]), 4 % 11 = 4 -> -5 + 4 = -1
    expect(rng.int(-5, 5)).toBe(-1);
  });

  it("handles the full 2^32 range boundary without throwing", () => {
    // range === 2^32 -> threshold === 2^32 -> every draw accepted.
    const rng = new Random(new MockSource([0, UINT32_RANGE - 1]));
    expect(rng.int(0, UINT32_RANGE - 1)).toBe(0);
    expect(rng.int(0, UINT32_RANGE - 1)).toBe(UINT32_RANGE - 1);
  });

  it("throws RangeError when min > max", () => {
    const rng = new Random(new MockSource([0]));
    expect(() => rng.int(5, 1)).toThrow(RangeError);
  });

  it("throws RangeError when the range exceeds 2^32", () => {
    const rng = new Random(new MockSource([0]));
    expect(() => rng.int(0, UINT32_RANGE)).toThrow(RangeError);
  });

  it("throws TypeError for non-integer bounds", () => {
    const rng = new Random(new MockSource([0]));
    expect(() => rng.int(1.5, 6)).toThrow(TypeError);
    expect(() => rng.int(0, Number.NaN)).toThrow(TypeError);
    // @ts-expect-error wrong type on purpose
    expect(() => rng.int("0", 6)).toThrow(TypeError);
  });
});
