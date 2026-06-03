import type { RandomSource } from "./source";

/**
 * Web Crypto's `getRandomValues` rejects requests larger than 65536 bytes
 * (`QuotaExceededError`), so large fills are chunked at this boundary.
 */
const MAX_BYTES_PER_CALL = 65536;

/**
 * The default, secure {@link RandomSource}. Draws from a CSPRNG via
 * `globalThis.crypto.getRandomValues`, which is available in Node 20+, all
 * modern browsers, Deno, and Bun — a single code path with no environment
 * branching.
 *
 * @throws {Error} if Web Crypto is unavailable in the current runtime.
 */
export class CryptoSource implements RandomSource {
  private readonly crypto: Crypto;
  private readonly scratch = new Uint32Array(1);

  constructor() {
    const c = globalThis.crypto;
    if (!c || typeof c.getRandomValues !== "function") {
      throw new Error(
        "randomness-kit: the Web Crypto API (globalThis.crypto.getRandomValues) " +
          "is not available in this environment. Node 20+, a modern browser, " +
          "Deno, or Bun is required.",
      );
    }
    this.crypto = c;
  }

  nextUint32(): number {
    this.crypto.getRandomValues(this.scratch);
    return this.scratch[0] >>> 0;
  }

  fillBytes(buffer: Uint8Array): void {
    for (let offset = 0; offset < buffer.length; offset += MAX_BYTES_PER_CALL) {
      this.crypto.getRandomValues(
        buffer.subarray(offset, offset + MAX_BYTES_PER_CALL),
      );
    }
  }
}
