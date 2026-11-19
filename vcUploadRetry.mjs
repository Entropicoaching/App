// VC-UPLOAD2. Storage upload() cannot resume partial bytes. Retry is manual.
// U4: appen bærer flaget (DEFAULT_VC_UPLOAD_RETRY i src/videoUploadRetry.mjs) hertil som
// uploadRetry=1 i adressen. vc_upload_retry_v1 = '1' tænder og '0' slukker på én enhed.
export function uploadRetryEnabled(storage = () => globalThis.localStorage, search = globalThis.location?.search) {
  let value = null
  try { value = storage()?.getItem('vc_upload_retry_v1') ?? null }
  catch { value = null }
  if (value === '1') return true
  if (value === '0') return false
  try { return new URLSearchParams(search || '').get('uploadRetry') === '1' }
  catch { return false }
}

// U4: samme grænse og tekst som appens validateVideoUploadRequest (src/videoCoachUpload.js).
export const VC_UPLOAD_MAX_BYTES = 50 * 1024 * 1024
export const VC_UPLOAD_TOO_LARGE = 'Videoen er større end 50 MB. Optag et kortere klip eller i lavere kvalitet (fx 1080p), og send igen.'
// ORDRE 1616v: med videolageret (R2) bærer appen lager=1 i adressen, og grænsen er 200 MB
// (samme tal som VIDEOCOACH_LAGER_MAX_BYTES i src/videoCoachUpload.js), så 3 minutter kan sendes.
export const VC_LAGER_MAX_BYTES = 200 * 1024 * 1024
export function uploadMaxBytes(search = globalThis.location?.search) {
  try { return new URLSearchParams(search || '').get('lager') === '1' ? VC_LAGER_MAX_BYTES : VC_UPLOAD_MAX_BYTES }
  catch { return VC_UPLOAD_MAX_BYTES }
}

function failureReason(error) {
  const reason = typeof error?.message === 'string' ? error.message.trim().slice(0, 240) : ''
  return reason ? ` Årsag: ${reason.replace(/[.\s]+$/, '')}.` : ''
}

export function mountUploadRetry(document, retry, storage, search) {
  if (!uploadRetryEnabled(storage, search)) return null
  const panel = document.createElement('div')
  panel.id = 'vcUploadRetryStatus'
  panel.hidden = true
  panel.style.cssText = 'padding:12px;margin:12px;border:1px solid currentColor;border-radius:8px'
  const status = document.createElement('p')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Prøv igen'
  button.style.cssText = 'min-height:44px;min-width:100px'
  button.hidden = true
  const maxBytes = uploadMaxBytes(search)
  const tooLarge = VC_UPLOAD_TOO_LARGE.replace('50 MB', `${Math.round(maxBytes / 1048576)} MB`)
  panel.append(status, button)
  const host = document.getElementById?.('athleteSubmitCard') || document.body
  host.append(panel)
  let active = null
  const show = (text, canRetry = false) => {
    panel.hidden = false
    status.textContent = text
    button.hidden = !canRetry
    button.disabled = !canRetry
  }
  button.onclick = async () => {
    if (active || button.hidden || button.disabled) return
    button.disabled = true
    // The existing Send handler retains the file and client analysis id.
    try { return await retry() }
    finally { if (!active && !button.hidden) button.disabled = false }
  }
  return {
    reset() { if (!active) panel.hidden = true },
    tooLargeText: tooLarge,
    // En for stor fil afvises før overførslen. Intet "Prøv igen": samme fil fejler igen.
    refuseTooLarge(file) {
      if (active || !(file?.size > maxBytes)) return false
      show(tooLarge)
      return true
    },
    run(send) {
      if (active) return active
      show('Sender video. Bliv på skærmen, til den er sendt.')
      active = Promise.resolve().then(send).then(result => {
        // U9 (Marc 11. nov.): tydelig kvittering med klokkeslæt.
        const kl = new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(':', '.')
        show(`Sendt til Marc ✓ kl. ${kl}. Feedbacken kommer i Beskeder.`)
        return result
      }, error => {
        if (error?.vcAborted) show('Annulleret. Videoen er stadig valgt.')
        // ORDRE 1890v (Marc 19. nov.: "den siger bar fejl"): arket ligger over banneret, så årsagen står også her.
        else show(`Ikke sendt · Prøv igen. Videoen er stadig valgt, så du skal ikke vælge den igen. Hold skærmen åben, til den er sendt.${failureReason(error)}`, true)
        throw error
      }).finally(() => { active = null })
      return active
    },
  }
}
