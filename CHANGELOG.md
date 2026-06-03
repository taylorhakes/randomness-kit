# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
