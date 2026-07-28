/**
 * Coercion helpers for `@Value(..., { parse })`.
 *
 * Environment variables always arrive as strings. Without an explicit `parse`,
 * a field declared `number` holds `"3000"` and a field declared `boolean` holds
 * `"false"` — which is truthy. Every non-string config value must go through
 * one of these.
 */

export const toNumber = (value: unknown): number => Number(value);

export const toInt = (value: unknown): number => parseInt(String(value), 10);

/** Treats only `true` / `"true"` as true, so `"false"` cannot be truthy. */
export const toBoolean = (value: unknown): boolean =>
  value === true || String(value).toLowerCase() === 'true';
