import { describe, expect, it } from "vitest";
import { CryptoSource, Random, random } from "../src/index";

describe("CryptoSource", () => {
  it("nextUint32 returns values within [0, 2^32) across pool refills", () => {
    const src = new CryptoSource();
    const seen = new Set<number>();
    // 2000 draws spans several internal pool refills (pool is 256 words).
    for (let i = 0; i < 2000; i++) {
      const v = src.nextUint32();
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** 32);
      seen.add(v);
    }
    // The pool must not be replaying one buffer: distinct values dominate.
    expect(seen.size).toBeGreaterThan(1900);
  });

  it("fillBytes fills the whole buffer", () => {
    const src = new CryptoSource();
    const buf = new Uint8Array(64);
    src.fillBytes(buf);
    expect(buf.some((x) => x !== 0)).toBe(true);
  });

  it("two instances produce different output (overwhelmingly likely)", () => {
    const a = random().bytes(32).join(",");
    const b = random().bytes(32).join(",");
    expect(a).not.toBe(b);
  });
});

describe("int() distribution over a secure source", () => {
  it("covers every value of a small range and stays roughly uniform", () => {
    const rng = new Random();
    const counts = new Array<number>(6).fill(0);
    const draws = 60_000;
    for (let i = 0; i < draws; i++) {
      counts[rng.int(0, 5)]++;
    }
    const expected = draws / 6;
    for (const c of counts) {
      expect(c).toBeGreaterThan(0);
      // Within 15% of the expected frequency — generous but catches gross bias.
      expect(Math.abs(c - expected)).toBeLessThan(expected * 0.15);
    }
  });
});
