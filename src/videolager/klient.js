// ORDRE 1537v0: appens vej til videolageret (Cloudflare R2 bag en Worker, se worker.js).
// Slås til med VITE_VIDEOLAGER_URL. Uden den bruges Supabase-lageret som hidtil.
// Workeren udsteder en kort adresse efter Supabase-login; selve klippet går direkte til lageret.

export function videolagerUrl(env = import.meta.env) {
  const value = typeof env?.VITE_VIDEOLAGER_URL === 'string' ? env.VITE_VIDEOLAGER_URL.trim() : ''
  return /^https?:\/\/[^/]/.test(value) ? value.replace(/\/+$/, '') : ''
}

async function kald(base, sti, token, body, fetchFn, signal) {
  const svar = await fetchFn(base + sti, {
    method: 'POST', signal,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await svar.json().catch(() => null)
  return { status: svar.status, data }
}

// Samme svarform som supabase.storage.upload ({ data, error }), og den kaster ikke.
// Et klip, der allerede ligger der (samme client_analysis_id sendt igen), er ikke en fejl.
// ORDRE 1952: athleteId er den valgte atlet, så en coach kan sende for sin egen atlet (workeren tjekker det).
export async function uploadTilVideolager({ base, token, athleteId, clientAnalysisId, path, file, mimeType, signal, fetchFn = fetch }) {
  try {
    if (!token) return { data: null, error: { message: 'Log ind igen' } }
    const { status, data } = await kald(base, '/upload-url', token,
      { ...(athleteId ? { athlete_id: athleteId } : {}), client_analysis_id: clientAnalysisId, mime_type: mimeType, size: file.size }, fetchFn, signal)
    if (status !== 200 || !data) return { data: null, error: { message: data?.error || 'Videolageret svarede ikke', status } }
    if (data.key !== path) return { data: null, error: { message: 'Videolageret gav en anden sti end ventet' } }
    if (data.exists === true) return { data: { path }, error: null }
    if (typeof data.url !== 'string') return { data: null, error: { message: 'Videolageret svarede ikke' } }
    const put = await fetchFn(data.url, { method: 'PUT', signal, headers: data.headers || { 'content-type': mimeType }, body: file })
    if (put.status === 409) return { data: { path }, error: null }
    if (!put.ok) return { data: null, error: { message: `Videolageret afviste klippet (${put.status})`, status: put.status } }
    return { data: { path }, error: null }
  } catch {
    return { data: null, error: { message: signal?.aborted ? 'Annulleret' : 'Forbindelsen blev afbrudt. Prøv igen' } }
  }
}

// Adresse til at hente et klip. null betyder, at klippet ikke ligger i videolageret
// (ældre klip ligger i Supabase), eller at lageret ikke svarede; så bruges Supabase.
export async function hentFraVideolager({ base, token, videoPath, signal, fetchFn = fetch }) {
  try {
    if (!token) return null
    const { status, data } = await kald(base, '/download-url', token, { video_path: videoPath }, fetchFn, signal)
    return status === 200 && typeof data?.url === 'string' ? data.url : null
  } catch { return null }
}
