# Design Document — `randomness-kit`

A small, dependency-free TypeScript library for randomness that is **secure by
default** and works identically in Node, browsers, Deno, and Bun.

- **Status:** Approved (Double Diamond: Discover → Define → Develop → Deliver)
- **Date:** 2026-06-02
- **Reviewers:** Claude (author), Codex CLI, Gemini CLI (multi-provider research + adversarial debate gate)

---

## 1. Goals & Requirements

### Functional
1. **Random bytes** — `bytes(n) → Uint8Array`.
2. **Random integer in a range** — `int(min, max)`, inclusive, statistically **unbiased**.
3. **Random string** — `string(length, charset?)` with an optional custom character set.

### Non-functional
- **Zero runtime dependencies.**
- **Secure by default**: all randomness draws from a CSPRNG (Web Crypto).
- **One environment-agnostic code path** — no Node-vs-browser branching.
- Dual **ESM + CJS** output with complete **TypeScript types**.
- **Testable**: the entropy source is injectable, so the value-shaping logic
  (range bias, string charset, edge cases) is unit-testable with a deterministic
  mock source — no need to ship a PRNG.

### Explicit non-goals (v1)
- **No seeding / deterministic mode.** Deferred to keep v1 simple (see §8). The
  `RandomSource` seam is retained so it can be added later without an API break.
- Not a cryptographic primitives library (no hashing, signing, key derivation).
- No distribution helpers beyond the basics (no Gaussian/Poisson/etc.).
- No `int()` ranges wider than `2^32` (validated and rejected).

---

## 2. Architecture

A thin **source/provider seam** separates *where bits come from* from *how
they're shaped into useful values*. v1 ships exactly one source (`CryptoSource`);
the seam exists for **test injection** and **future seeding**.

```
                ┌─────────────────────────────┐
                │          Random             │  ergonomic API
                │  bytes/int/float/bool/      │  (shapes raw bits)
                │  string/pick                │
                └──────────────┬──────────────┘
                               │ depends on
                ┌──────────────▼──────────────┐
                │     RandomSource (iface)    │
                │  nextUint32(): number       │
                │  fillBytes(buf): void       │
                └──────────────┬──────────────┘
                               │ implemented by
                ┌──────────────▼──────────────┐         ┌──────────────────────┐
                │        CryptoSource         │         │  (test only) mock     │
                │  globalThis.crypto          │         │  RandomSource with a  │
                │  .getRandomValues           │         │  scripted sequence    │
                │  secure · the only shipped  │         │  — injected in tests  │
                │  source                     │         └──────────────────────┘
                └─────────────────────────────┘
```

### `RandomSource` contract
```ts
interface RandomSource {
  /** Next unsigned 32-bit integer in [0, 2^32). */
  nextUint32(): number;
  /** Fill an existing Uint8Array with random bytes. */
  fillBytes(buffer: Uint8Array): void;
}
```

`Random` holds a `RandomSource` and never touches the entropy mechanism
directly. Production code always gets a `CryptoSource`; tests construct
`new Random(mockSource)` to feed scripted values and assert exact shaping
behavior (e.g. that a given `nextUint32` triggers rejection, or maps to a
specific integer).

---

## 3. Algorithm Decisions

### 3.1 Entropy source: **Web Crypto only**
`CryptoSource` uses **`globalThis.crypto.getRandomValues`** exclusively.

- Available in **Node 20+** (Web Crypto is a default global), all **modern browsers**,
  **Deno**, and **Bun** — one code path, no `node:crypto` fallback, no branching.
- Constructor checks `globalThis.crypto?.getRandomValues` once and throws a clear
  `Error` if absent (e.g. ancient runtimes), rather than failing later.
- `nextUint32()` draws 4 bytes into a reused `Uint32Array(1)` and returns `[0] >>> 0`.
- `fillBytes(buf)` delegates directly to `getRandomValues` (chunked at 65536 bytes,
  the spec's per-call quota, so large buffers don't throw `QuotaExceededError`).

### 3.2 Unbiased integer in range — modulo-with-rejection
For inclusive `[min, max]`:
```
range     = max - min + 1            // plain JS number, never bitwise
MAX       = 2 ** 32                  // 4294967296 (exact double)
threshold = MAX - (MAX % range)      // largest multiple of range ≤ MAX
do { r = source.nextUint32() } while (r >= threshold)
return min + (r % range)
```
- All range/threshold arithmetic stays in IEEE-754 doubles (exact ≤ `2^53`);
  **no `<<`/`>>>` applied to `range`** (which would wrap `2^32 → 0`).
- `range == 2^32` ⇒ `threshold == 2^32`, every draw accepted, `r % range == r`. Correct.
- Validation: `min`/`max` finite safe integers, `min <= max`, `range <= 2^32`.

> Naming note (per debate gate): this is **modulo-with-rejection**, *not* Lemire's
> multiply-high method. Documented accurately.

### 3.3 `float()` — full 53-bit precision
Two draws combined to match the precision of a standard IEEE-754 double
(a single 32-bit draw would give only 32 bits):
```
hi = nextUint32() >>> 5        // 27 bits
lo = nextUint32() >>> 6        // 26 bits
return (hi * 2 ** 26 + lo) / 2 ** 53   // [0, 1)
```

### 3.4 `bytes(n)`
Delegates to `source.fillBytes` on a fresh `Uint8Array(n)`. With `CryptoSource`
this is a direct `getRandomValues` fill (chunked for large `n`). Validates
`n` is a non-negative safe integer; `bytes(0)` → empty array.

### 3.5 `string(length, charset?)`
- Default charset: `A–Z a–z 0–9` (62 chars).
- Each character index chosen via the **unbiased** `int(0, charset.length - 1)` —
  no `% charset.length` bias.
- Validates non-empty charset and `length >= 0`. `string(0)` → `""`.
- Charset is treated as an array of code points so multi-byte/emoji charsets work
  (no surrogate splitting).

### 3.6 `bool(p = 0.5)`
`float() < p`. Validates `0 <= p <= 1` and rejects `NaN`/`Infinity`.
`bool(0)` always `false`; `bool(1)` always `true`.

### 3.7 `pick(items)`
Uniform element via `items[int(0, items.length - 1)]`. Throws on empty array.

---

## 4. Public API

```ts
// ── Factory ───────────────────────────────────────────────
random();                 // secure, crypto-backed (default)
new Random(source?);      // advanced/testing: inject any RandomSource
                          //   (defaults to CryptoSource when omitted)

// ── Instance methods (on Random) ──────────────────────────
.bytes(length: number): Uint8Array;          // n random bytes
.int(min: number, max: number): number;      // inclusive, unbiased
.float(): number;                             // [0, 1), 53-bit
.bool(p?: number): boolean;                   // p = probability of true
.string(length: number, charset?: string): string;
.pick<T>(items: readonly T[]): T;             // uniform element

// ── Exposed building blocks ───────────────────────────────
class CryptoSource implements RandomSource {}
interface RandomSource { nextUint32(): number; fillBytes(buf: Uint8Array): void }
```

### Errors
- `TypeError` — wrong argument types (non-integer range, empty charset, non-array `pick`).
- `RangeError` — `min > max`, range `> 2^32`, `length < 0`, `p` out of `[0,1]`.
- `Error` — Web Crypto unavailable when constructing `CryptoSource`.

---

## 5. Security Model

Every value comes from a CSPRNG, so the library is **secure by default** — safe
for tokens, IDs, salts, and other security-sensitive uses.

| Concern | Position |
|---------|----------|
| Source | `globalThis.crypto.getRandomValues` (CSPRNG) only. |
| Bias | `int`/`string`/`pick` use rejection sampling — uniform, no modulo bias. |
| `float()` | 53-bit; **not** for cryptographic decisions requiring constant-time/uniform-bit guarantees, but fine for general use. |
| Reproducibility | None in v1 (no seeding) — output is always unpredictable, by design. |

> When seeding lands (§8) it will be a **separate, clearly-labelled non-secure
> source**; the secure default will not change.

---

## 6. Repository Layout

```
randomness/
├─ package.json            # ESM+CJS exports, scripts, metadata
├─ tsconfig.json           # strict TS config
├─ tsup.config.ts          # bundler → dist/ (esm, cjs, d.ts)
├─ vitest.config.ts        # test runner
├─ eslint.config.mjs       # flat config + typescript-eslint
├─ .gitignore / .npmignore
├─ LICENSE                 # MIT
├─ README.md               # usage + notes
├─ CHANGELOG.md
├─ DESIGN.md               # this document
├─ src/
│  ├─ index.ts             # public exports + random() factory
│  ├─ random.ts            # Random class (bytes/int/float/bool/string/pick)
│  ├─ source.ts            # RandomSource interface
│  ├─ crypto-source.ts     # CryptoSource (globalThis.crypto.getRandomValues)
│  └─ errors.ts            # validation helpers
└─ test/
   ├─ mock-source.ts       # test helper: scripted RandomSource
   ├─ int.test.ts          # range correctness + bias + 2^32 boundary
   ├─ string.test.ts       # length, charset, distribution, unicode
   ├─ bytes.test.ts        # length, chunking, validation
   ├─ float-bool.test.ts   # 53-bit float range, bool(p) edges
   ├─ pick.test.ts         # uniform element selection, empty-array error
   └─ crypto-source.test.ts# secure source produces distinct, correct-length output
```

---

## 7. Testing Strategy

Tests inject a **mock `RandomSource`** (`test/mock-source.ts`) that returns a
scripted sequence of uint32 values, making the shaping logic fully deterministic
without seeding:

- **Rejection sampling:** feed a value `>= threshold` and assert it's skipped, then
  the next in-range value is used. Verify `int(n, n) === n`.
- **Bias / uniformity:** with `CryptoSource`, draw many `int()` over a small range and
  assert every value appears with roughly expected frequency.
- **`2^32` boundary:** `int(0, 2**32 - 1)` accepts any draw and never throws.
- **Edge cases:** `bytes(0)` → empty; `string(0)` → `""`; empty charset throws;
  `min > max` throws; range `> 2^32` throws; `bool(0)`/`bool(1)` deterministic;
  `pick([])` throws.
- **`float()`:** always in `[0, 1)`; 53-bit combination verified via scripted hi/lo draws.
- **Unicode charset:** emoji/multi-byte charset selects whole code points.
- **CryptoSource:** two instances produce different bytes; correct length; large
  `bytes()` (> 65536) succeeds via chunking.
- **Build smoke-test:** `dist/` imports under both ESM and CJS.

---

## 8. Open Questions / Future Work
- **Seeding / deterministic mode** as a separate non-secure `Sfc32Source`
  (sfc32 + cyrb128 seed expansion + warm-up) behind the existing `RandomSource`
  seam — additive, no breaking change.
- Optional pluggable algorithms behind `RandomSource`.
- Distribution helpers (normal, weighted choice).
- 64-bit / BigInt range support for `int()`.
