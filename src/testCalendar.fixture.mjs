// Synthetic fixture dates only. SQL callers must read their own live PGlite
// clock; a JavaScript Date mock is not evidence about the real SQL calendar.
export function calendarFixture(today) {
  const time = Date.parse(`${today}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== today) throw new TypeError('Invalid fixture day')
  const day = offset => {
    if (!Number.isSafeInteger(offset)) throw new TypeError('Invalid fixture offset')
    return new Date(time + offset * 86400000).toISOString().slice(0, 10)
  }
  return Object.freeze({ today, day, dates: Object.freeze([1, 2, 3].map(day)) })
}

export async function sqlCalendarFixture(db) {
  const { rows: [clock] } = await db.query(`select
    (stamp at time zone 'Europe/Copenhagen')::date::text as today,
    stamp::text as approved_at,
    date_trunc('week', stamp at time zone 'Europe/Copenhagen')::date::text as week_start
    from (select clock_timestamp() as stamp) fixture_clock`)
  return Object.freeze({ ...calendarFixture(clock.today), approvedAt: clock.approved_at, weekStart: clock.week_start })
}
