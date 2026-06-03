import { describe, expect, it } from "vitest";
import { random } from "../src/index";

describe("bytes()", () => {
  it("returns a Uint8Array of the requested length", () => {
    const b = random().bytes(32);
    expect(b).toBeInstanceOf(Uint8Array);
    expect(b).toHaveLength(32);
  });

  it("returns an empty array for length 0", () => {
    expect(random().bytes(0)).toHaveLength(0);
  });

  it("chunks large requests beyond the 65536-byte Web Crypto quota", () => {
    const b = random().bytes(200_000);
    expect(b).toHaveLength(200_000);
    // Sanity: not all zeros (would indicate the fill never ran).
    expect(b.some((x) => x !== 0)).toBe(true);
  });

  it("throws RangeError for a negative length", () => {
    expect(() => random().bytes(-1)).toThrow(RangeError);
  });

  it("throws TypeError for a non-integer length", () => {
    expect(() => random().bytes(1.5)).toThrow(TypeError);
  });
});
