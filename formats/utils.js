/**
 * Strip a trailing 'px' suffix from a string value, returning a Number.
 * Returns the input unchanged if it's already a number, or if no px suffix is found.
 */
export function stripPx(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  const m = v.match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? Number(m[1]) : v;
}

/**
 * True if a value is numeric or a numeric-with-optional-px string.
 * Used by spacing/radius filters to skip unresolved references.
 */
export function isNumericLike(v) {
  if (typeof v === 'number') return true;
  return typeof v === 'string' && /^-?\d+(?:\.\d+)?(?:px)?$/.test(v);
}
