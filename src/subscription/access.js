export function normalizeAccess(data) {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || !['free', 'member'].includes(row.tier)) {
    return { tier: 'free', valid: false }
  }
  return {
    tier: row.tier,
    valid: true,
  }
}

export async function loadMyAccess(client) {
  const { data, error } = await client.rpc('sub_my_access_v2')
  if (error) throw new Error(`Adgang kunne ikke læses: ${error.message}`)
  const access = normalizeAccess(data)
  if (!access.valid) throw new Error('Adgangssvaret havde et ukendt format.')
  return access
}
