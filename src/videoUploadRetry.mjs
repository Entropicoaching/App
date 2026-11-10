// U4: ét flag for uploadmodulet med "Prøv igen" (VC-UPLOAD2). Appen bærer det til
// videosiden som uploadRetry=1 i iframens adresse. vc_upload_retry_v1 = '1' tænder og
// '0' slukker på én enhed; ellers gælder standardværdien.
export const DEFAULT_VC_UPLOAD_RETRY = false

export function videoUploadRetryEnabled(storage = () => globalThis.localStorage) {
  let value = null
  try { value = storage()?.getItem('vc_upload_retry_v1') ?? null }
  catch { value = null }
  if (value === '1') return true
  if (value === '0') return false
  return DEFAULT_VC_UPLOAD_RETRY === true
}

export function withUploadRetryFlag(url, enabled = videoUploadRetryEnabled()) {
  return enabled === true ? url + (url.includes('?') ? '&' : '?') + 'uploadRetry=1' : url
}

// No automatic retries and no alternate transport. Normalize thrown network
// errors so the existing bridge replies and the athlete can click Send again.
export async function uploadVideoAttempt(createClient, signal, bucket, path, file, mimeType) {
  try {
    const result = await createClient(signal).storage.from(bucket)
      .upload(path, file, { contentType: mimeType, upsert: false })
    if (signal.aborted) return { error: { message: 'Annulleret' } }
    return result
  } catch {
    return { error: { message: signal.aborted ? 'Annulleret' : 'Forbindelsen blev afbrudt. Prøv igen' } }
  }
}
