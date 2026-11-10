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
    run(send) {
      if (active) return active
      show('Sender video. Bliv på skærmen, til den er sendt.')
      active = Promise.resolve().then(send).then(result => {
        show('Video modtaget. Din coach gennemgår den.')
        return result
      }, error => {
        if (error?.vcAborted) show('Annulleret. Videoen er stadig valgt.')
        else show('Videoen blev ikke sendt. Videoen er stadig valgt. Prøv igen. Overførslen starter forfra, da uploadklienten ikke kan genoptage en delvis fil. Behold denne skærm åben.', true)
        throw error
      }).finally(() => { active = null })
      return active
    },
  }
}
