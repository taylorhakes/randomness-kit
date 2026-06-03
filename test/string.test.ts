import { describe, expect, it } from "vitest";
import { random, Random } from "../src/index";
import { MockSource } from "./mock-source";

describe("string()", () => {
  it("produces the requested length", () => {
    expect(random().string(20)).toHaveLength(20);
  });

  it("returns an empty string for length 0", () => {
    expect(random().string(0)).toBe("");
  });

  it("uses the default alphanumeric charset", () => {
    const s = random().string(200);
    expect(s).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("selects characters by unbiased index from a custom charset", () => {
    // charset "abcd" (len 4) -> 2 bits; top-2-bit draws 0,1,2,3 -> "abcd".
    const rng = new Random(
      new MockSource([0, 1 * 2 ** 30, 2 * 2 ** 30, 3 * 2 ** 30]),
    );
    expect(rng.string(4, "abcd")).toBe("abcd");
  });

  it("treats the charset by code point so emoji are not split", () => {
    // charset len 3 -> 2 bits; top-2-bit draws 0,2,1 -> 🍎🍊🍐.
    const charset = "🍎🍐🍊";
    const rng = new Random(new MockSource([0, 2 * 2 ** 30, 1 * 2 ** 30]));
    expect(rng.string(3, charset)).toBe("🍎🍊🍐");
  });

  it("throws TypeError for an empty charset", () => {
    expect(() => random().string(4, "")).toThrow(TypeError);
  });

  it("throws RangeError for a negative length", () => {
    expect(() => random().string(-1)).toThrow(RangeError);
  });

  it("throws TypeError for a non-integer length", () => {
    expect(() => random().string(2.5)).toThrow(TypeError);
  });
});
