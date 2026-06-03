/**
 * The seam between *where random bits come from* and *how they are shaped* into
 * useful values by {@link Random}.
 *
 * v1 ships exactly one implementation, {@link CryptoSource}. The interface is
 * public so that:
 *  - tests can inject a deterministic, scripted source, and
 *  - a future seeded/deterministic source can be added without an API break.
 */
export interface RandomSource {
  /** Returns the next unsigned 32-bit integer, uniformly in `[0, 2^32)`. */
  nextUint32(): number;

  /** Fills an existing `Uint8Array` in place with random bytes. */
  fillBytes(buffer: Uint8Array): void;
}
