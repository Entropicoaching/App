// Set-mærket (ordre 1891): når atleten åbner Kost, skrives én række pr. sendt dagsversion
// i den sendte uge. Coachen læser rækkerne i coach/claudeWeekModel.mjs.
// Mangler tabellen (som i produktion før migrationen), eller fejler noget, sker der intet
// synligt: funktionen kaster aldrig, og Kost opfører sig som før.
const PLANS = 'kostplan_v1_plans', VERSIONS = 'kostplan_v1_versions', APPROVALS = 'kostplan_v1_approvals', SEEN = 'kostplan_v1_seen'
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 160
const day = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
const plusDage = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const rows = result => (result && !result.error && Array.isArray(result.data) ? result.data : null)

// Ren udvælgelse: den nyeste sendte version pr. udgivet plan for atleten.
export function seenRows({ plans = [], versions = [], approvals = [], athleteId }) {
  const sent = new Set(approvals.filter(a => a.athlete_id === athleteId).map(a => a.version_id))
  return plans.filter(p => p.athlete_id === athleteId && p.status === 'godkendt').flatMap(p => {
    const latest = versions.filter(v => v.plan_id === p.id && sent.has(v.id)).sort((a, b) => b.version_no - a.version_no)[0]
    return latest ? [{ athlete_id: athleteId, plan_id: p.id, version_id: latest.id }] : []
  })
}

// Ugen kan starte op til 6 dage før i dag og være sendt op til en uge frem.
export async function markSentWeekSeen({ client, athleteId, date }) {
  try {
    if (typeof client?.from !== 'function' || !identifier(athleteId) || !day(date)) return { written: 0 }
    const plans = rows(await client.from(PLANS).select('id,athlete_id,valid_from,status').eq('athlete_id', athleteId)
      .eq('status', 'godkendt').gte('valid_from', plusDage(date, -6)).lte('valid_from', plusDage(date, 13)).limit(50))
    if (!plans?.length) return { written: 0 }
    const ids = plans.map(p => p.id)
    const versions = rows(await client.from(VERSIONS).select('id,plan_id,version_no').in('plan_id', ids).limit(501))
    const approvals = rows(await client.from(APPROVALS).select('version_id,plan_id,athlete_id').in('plan_id', ids).eq('athlete_id', athleteId).limit(501))
    if (!versions || !approvals) return { written: 0 }
    const marks = seenRows({ plans, versions, approvals, athleteId })
    if (!marks.length) return { written: 0 }
    // Første gang tæller: en gentaget åbning skriver ingen dublet og flytter ikke datoen.
    const result = await client.from(SEEN).upsert(marks, { onConflict: 'athlete_id,version_id', ignoreDuplicates: true })
    return { written: result?.error ? 0 : marks.length }
  } catch {
    return { written: 0 }
  }
}
