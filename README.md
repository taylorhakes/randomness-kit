# randomness-kit

[![CI](https://github.com/taylorhakes/randomness-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/taylorhakes/randomness-kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/randomness-kit.svg)](https://www.npmjs.com/package/randomness-kit)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Small, dependency-free, **secure-by-default** randomness utilities for
JavaScript and TypeScript. Works identically in **Node 20+, modern browsers,
Deno, and Bun** — one code path, no environment branching.

All randomness is drawn from a CSPRNG (`globalThis.crypto.getRandomValues`), and
every helper that picks from a range uses **rejection sampling** to avoid modulo
bias.

## Features

- `bytes(n)` — `n` cryptographically random bytes.
- `int(min, max)` — uniform integer in an inclusive range, no modulo bias.
- `string(length, charset?)` — random string with an optional custom character set.
- `float()` — `[0, 1)` with full 53-bit precision.
- `bool(p?)` — `true` with probability `p`.
- `pick(items)` — a uniformly chosen array element.
- Zero dependencies · ESM + CJS · full TypeScript types.

## Install

```sh
npm install randomness-kit
```

## Usage

```ts
import { random } from "randomness-kit";

const rng = random();

rng.bytes(16);            // Uint8Array(16) [ ... ]
rng.int(1, 6);            // e.g. 4  (inclusive of both 1 and 6)
rng.string(12);           // e.g. "a8Kf0Zq2LpXr"  (A–Z a–z 0–9)
rng.string(8, "01");      // e.g. "10110010"  (custom charset)
rng.float();              // e.g. 0.5703726…  ([0, 1))
rng.bool();               // true | false
rng.bool(0.9);            // true ~90% of the time
rng.pick(["red", "green", "blue"]); // e.g. "green"
```

CommonJS works too:

```js
const { random } = require("randomness-kit");
```

## API

### `random(): Random`

Creates a secure, crypto-backed `Random` instance.

### `class Random`

| Method | Returns | Notes |
| --- | --- | --- |
| `bytes(length)` | `Uint8Array` | `length` random bytes. Each call is self-contained. |
| `int(min, max)` | `number` | Inclusive `[min, max]`, unbiased. Spans up to `2^53` values. Throws if `min > max` or the span exceeds `2^53`. |
| `float()` | `number` | `[0, 1)`, 53-bit precision. |
| `bool(p = 0.5)` | `boolean` | `true` with probability `p` (`0 ≤ p ≤ 1`). |
| `string(length, charset?)` | `string` | Default charset `A–Z a–z 0–9`. Charset is read by Unicode code point (emoji-safe). |
| `pick(items)` | `T` | Uniform element. Throws on an empty array. |

### Advanced: custom sources

`new Random(source?)` accepts any `RandomSource`. The default is `CryptoSource`.
This seam is primarily for **testing** — inject a deterministic source to make
output predictable:

```ts
import { Random, type RandomSource } from "randomness-kit";

class FixedSource implements RandomSource {
  nextUint32() { return 42; }
  fillBytes(buf: Uint8Array) { buf.fill(42); }
}

const rng = new Random(new FixedSource());
rng.int(1, 6); // deterministic
```

## Security

- **Secure by default.** All values come from a CSPRNG, so output is suitable for
  tokens, IDs, and salts.
- `int`, `string`, and `pick` use rejection sampling — **no modulo bias**.
- This library does **not** provide cryptographic primitives (hashing, signing,
  key derivation). Use the platform crypto APIs for those.

> **Note on seeding.** A deterministic/seeded mode is intentionally not included
> in v1. The `RandomSource` interface is public so it can be added later as a
> separate, clearly-labelled **non-secure** source without breaking the API.

## Environment support

| Runtime | Supported |
| --- | --- |
| Node | 20+ |
| Browsers | All modern (Web Crypto) |
| Deno | ✅ |
| Bun | ✅ |

## License

[MIT](./LICENSE)
