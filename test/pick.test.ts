import { describe, expect, it } from "vitest";
import { random, Random } from "../src/index";
import { MockSource } from "./mock-source";

describe("pick()", () => {
  it("selects the element at the unbiased index", () => {
    // 3 items -> 2 bits; a draw whose top 2 bits == 1 selects index 1.
    const rng = new Random(new MockSource([1 * 2 ** 30]));
    expect(rng.pick(["a", "b", "c"])).toBe("b");
  });

  it("always returns a member of the array", () => {
    const rng = random();
    const items = [10, 20, 30, 40];
    for (let i = 0; i < 1000; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("throws RangeError for an empty array", () => {
    expect(() => random().pick([])).toThrow(RangeError);
  });

  it("throws TypeError for a non-array", () => {
    // @ts-expect-error wrong type on purpose
    expect(() => random().pick("abc")).toThrow(TypeError);
  });
});
