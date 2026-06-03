# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-02

### Added
- `int(min, max)` now supports spans up to `2^53` values (previously capped at
  `2^32`), covering the full safe-integer range. Ranges wider than `2^32` are
  drawn by combining two 32-bit words. Spans beyond `2^53` throw `RangeError`.

### Changed
- `int()` now uses bit-length rejection sampling (CPython's `getrandbits`
  technique) instead of modulo-with-rejection: it consumes only as many bits as
  the range needs and short-circuits `min === max` without a draw. Bit length is
  computed with `Math.clz32` (exact integer op, no `log2` rounding risk).
- `CryptoSource.nextUint32()` now serves from a pooled buffer, refilling 256
  words per `getRandomValues` call — far fewer syscalls, ~90× faster `string()`.

All changes are backward compatible; existing `int()` calls behave identically.

## [0.1.0] - 2026-06-02

### Added
- Initial release.
- `random()` factory and `Random` class with:
  - `bytes(length)` — cryptographically random bytes (chunked for large sizes).
  - `int(min, max)` — unbiased inclusive integer range via rejection sampling.
  - `float()` — `[0, 1)` with 53-bit precision.
  - `bool(p?)` — biased coin flip.
  - `string(length, charset?)` — random string with optional code-point-aware charset.
  - `pick(items)` — uniform array element.
- `CryptoSource` (secure default) and the public `RandomSource` interface for
  test injection / future seeding.
- Dual ESM + CJS build with TypeScript declarations.
