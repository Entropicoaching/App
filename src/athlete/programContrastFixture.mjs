// Synthetic program data only; no service client or application state.
export function contrastFixture(extra = {}) {
  const allWeeks = [0, 1, 2].map(index => ({ id: `contrast-week-${index}`, week_number: index + 1,
    block_name: 'Basis', start_date: `2026-11-${String(2 + index * 7).padStart(2, '0')}`,
    sessions: [] }))
  return { allWeeks, currentWeek: allWeeks[1], viewingWeekIdx: 1,
    athlete: { id: 'contrast-fixture' }, computeActiveWeekIdx: () => 1,
    weekStartDate: () => null, fmtWeekRange: () => null,
    exerciseLogs: [], pastLogs: [], ...extra }
}

export function contrastRatio(foreground, background) {
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const a = luminance(foreground), b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
