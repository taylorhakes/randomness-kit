import type { RandomSource } from "../src/source";

/**
 * A deterministic {@link RandomSource} for tests: returns a scripted sequence of
 * uint32 values, letting us assert exact shaping behavior (rejection sampling,
 * bias, float combination) without any real randomness.
 */
export class MockSource implements RandomSource {
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  nextUint32(): number {
    if (this.index >= this.values.length) {
      throw new Error(
        `MockSource exhausted after ${this.values.length} value(s)`,
      );
    }
    return this.values[this.index++]! >>> 0;
  }

  fillBytes(buffer: Uint8Array): void {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = this.nextUint32() & 0xff;
    }
  }
}
