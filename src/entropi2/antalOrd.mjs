/** Select a Danish count phrase without changing the displayed count.
 * Numeric input strings are accepted; ranges and unknown values use plural.
 * Call with the raw count, before number formatting. No I/O or feature state.
 */
export function antalOrd(count, singular, plural) {
  const value = typeof count === 'string' ? Number(count) : count
  return value === 1 ? singular : plural
}
