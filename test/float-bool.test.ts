import { describe, expect, it } from "vitest";
import { random, Random } from "../src/index";
import { MockSource } from "./mock-source";

const UINT32_MAX = 2 ** 32 - 1;

describe("float()", () => {
  it("returns 0 when both draws are 0", () => {
    const rng = new Random(new MockSource([0, 0]));
    expect(rng.float()).toBe(0);
  });

  it("stays within [0, 1) even at the maximum draws", () => {
    const rng = new Random(new MockSource([UINT32_MAX, UINT32_MAX]));
    const f = rng.float();
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThan(1);
  });

  it("combines two draws into 53-bit precision", () => {
    const rng = new Random(new MockSource([UINT32_MAX, UINT32_MAX]));
    const hi = UINT32_MAX >>> 5;
    const lo = UINT32_MAX >>> 6;
    expect(rng.float()).toBe((hi * 2 ** 26 + lo) / 2 ** 53);
  });

  it("always produces values in range over many secure draws", () => {
    const rng = random();
    for (let i = 0; i < 10_000; i++) {
      const f = rng.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });
});

describe("bool()", () => {
  it("bool(0) is always false and consumes no draws", () => {
    const rng = new Random(new MockSource([]));
    expect(rng.bool(0)).toBe(false);
  });

  it("bool(1) is always true and consumes no draws", () => {
    const rng = new Random(new MockSource([]));
    expect(rng.bool(1)).toBe(true);
  });

  it("returns true when float() < p", () => {
    // float() == 0 here, so any p > 0 yields true.
    const rng = new Random(new MockSource([0, 0]));
    expect(rng.bool(0.5)).toBe(true);
  });

  it("throws RangeError when p is outside [0, 1]", () => {
    expect(() => random().bool(-0.1)).toThrow(RangeError);
    expect(() => random().bool(1.1)).toThrow(RangeError);
  });

  it("throws TypeError when p is not finite", () => {
    expect(() => random().bool(Number.NaN)).toThrow(TypeError);
    expect(() => random().bool(Infinity)).toThrow(TypeError);
  });
});
