export function videoUploadRetryEnabled() {
  try { return globalThis.localStorage?.getItem('vc_upload_retry_v1') === '1' }
  catch { return false }
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
