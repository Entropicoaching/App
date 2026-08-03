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

export function isTransientAccessClockError(error) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes('jwt issued at future') || message.includes('jwt not yet valid')
}

export async function retryTransientAccessClock(
  operation,
  {
    delays = [500, 1500, 3000],
    wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  } = {},
) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      if (!isTransientAccessClockError(error) || attempt >= delays.length) throw error
      await wait(delays[attempt])
    }
  }
}

export async function loadMyAccess(client) {
  const { data, error } = await client.rpc('sub_my_access_v2')
  if (error) throw new Error(`Adgang kunne ikke læses: ${error.message}`)
  const access = normalizeAccess(data)
  if (!access.valid) throw new Error('Adgangssvaret havde et ukendt format.')
  return access
}
