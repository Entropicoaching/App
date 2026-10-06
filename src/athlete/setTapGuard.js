// The next set replaces the current set immediately. A rapid second tap on
// the same physical button must not log/skip that next set as well.
export function canAcceptSetTap(previousAt, now) {
  return now - previousAt >= 500
}
