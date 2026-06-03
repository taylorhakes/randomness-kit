/** Internal validation helpers. All messages are prefixed for easy grepping. */

const PREFIX = "randomness-kit:";

function describe(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (value === null) return "null";
  return typeof value;
}

/**
 * Asserts `value` is a safe integer (finite, non-fractional, within
 * `Number.MAX_SAFE_INTEGER`). Throws {@link TypeError} otherwise.
 */
export function assertSafeInteger(value: number, name: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(
      `${PREFIX} ${name} must be a safe integer, got ${describe(value)}.`,
    );
  }
}

/**
 * Asserts `value` is a non-negative safe integer. Non-integers throw
 * {@link TypeError}; negative integers throw {@link RangeError}.
 */
export function assertNonNegativeInteger(value: number, name: string): void {
  assertSafeInteger(value, name);
  if (value < 0) {
    throw new RangeError(`${PREFIX} ${name} must be >= 0, got ${value}.`);
  }
}
