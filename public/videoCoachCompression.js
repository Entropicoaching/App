// Browserens egne codecs. Ingen netværkskald eller ændring af originalfilen.
export const VIDEO_BITS_PER_SECOND = 4_000_000
export const AUDIO_BITS_PER_SECOND = 128_000

export function videoCompressionDimensions(width, height) {
  if (!(width > 0 && height > 0)) throw new Error('Ugyldig videoopløsning')
  const scale = Math.min(1, 1920 / Math.max(width, height), 1080 / Math.min(width, height))
  return {
    width: Math.max(2, Math.floor(width * scale / 2) * 2),
    height: Math.max(2, Math.floor(height * scale / 2) * 2),
  }
}

function abortError() {
  const error = new Error('Komprimeringen blev annulleret')
  error.name = 'AbortError'
  return error
}

// Returnerer altid originalen ved manglende understøttelse eller fejl.
// Kun en udtrykkelig annullering afbryder også den efterfølgende upload.
export function compressVideoForUpload(file, {
  enabled = false, signal, onProgress, environment = globalThis,
} = {}) {
  if (!enabled) return Promise.resolve(file)
  if (signal?.aborted) return Promise.reject(abortError())

  return new Promise((resolve, reject) => {
    let video, canvas, sourceStream, canvasStream, recorder, objectUrl
    let frameId, useVideoFrames = false, settled = false, started = false, completed = false
    let lastProgress = -1
    const chunks = [], listeners = [], timers = new Set()
    const env = environment
    const later = (callback, ms) => {
      const id = env.setTimeout(() => { timers.delete(id); callback() }, ms)
      timers.add(id)
      return id
    }
    const listen = (target, name, callback) => {
      target.addEventListener(name, callback)
      listeners.push(() => target.removeEventListener(name, callback))
    }
    const progress = value => {
      if (value === lastProgress) return
      lastProgress = value
      try { onProgress?.(value) } catch { /* Status må ikke blokere uploaden. */ }
    }
    const cleanup = () => {
      for (const id of timers) env.clearTimeout(id)
      for (const remove of listeners) remove()
      if (frameId != null) {
        try {
          if (useVideoFrames) video.cancelVideoFrameCallback(frameId)
          else env.cancelAnimationFrame(frameId)
        } catch { /* Frigiv spor og URL selv ved en ugyldig frame callback. */ }
      }
      try { if (recorder && recorder.state !== 'inactive') recorder.stop() } catch { /* Frigiv resten. */ }
      const tracks = new Set([...(sourceStream?.getTracks() || []), ...(canvasStream?.getTracks() || [])])
      for (const track of tracks) { try { track.stop() } catch { /* Frigiv resten. */ } }
      if (video) {
        try { video.pause(); video.removeAttribute('src'); video.load() } catch { /* Frigiv URL. */ }
      }
      if (objectUrl) env.URL.revokeObjectURL(objectUrl)
    }
    const finish = (result = file, error) => {
      if (settled) return
      settled = true
      try { cleanup() } catch { /* Oprydningsfejl må ikke afvise originalfilen. */ }
      if (error) reject(error)
      else resolve(result)
    }

    try {
      if (!file?.size || !env.document || env.document.visibilityState === 'hidden' ||
          !env.MediaRecorder?.isTypeSupported || !env.MediaStream || !env.File ||
          !env.URL?.createObjectURL || !env.requestAnimationFrame) { finish(); return }

      const mimeType = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
        'video/webm;codecs=vp8,opus', 'video/webm',
      ].find(type => env.MediaRecorder.isTypeSupported(type))
      if (!mimeType) { finish(); return }
      video = env.document.createElement('video')
      canvas = env.document.createElement('canvas')
      const captureSource = video.captureStream || video.mozCaptureStream
      const context = canvas.getContext('2d', { alpha: false })
      // captureStream er nødvendigt også for lyd. Safari bruger derfor originalen.
      if (!captureSource || !canvas.captureStream || !context) { finish(); return }
      video.muted = true // Mute påvirker højttaleren, ikke de fangede lydspor.
      video.playsInline = true
      video.preload = 'auto'

      listen(signal || new EventTarget(), 'abort', () => finish(file, abortError()))
      listen(env.document, 'visibilitychange', () => {
        // Skjulte faner kan få en fastfrosset canvasoptagelse.
        if (env.document.visibilityState === 'hidden') finish()
      })
      listen(video, 'error', () => finish())
      const metadataTimeout = later(() => finish(), 15_000)
      let lastTime = 0, lastAdvance = 0
      const begin = () => {
        if (settled || started || video.readyState < 2) return
        started = true
        if (!Number.isFinite(video.duration) || video.duration <= 0 ||
            !video.videoWidth || !video.videoHeight) { finish(); return }
        env.clearTimeout(metadataTimeout)
        timers.delete(metadataTimeout)
        try {
          const dimensions = videoCompressionDimensions(video.videoWidth, video.videoHeight)
          canvas.width = dimensions.width
          canvas.height = dimensions.height
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          sourceStream = captureSource.call(video)
          canvasStream = canvas.captureStream()
          if (!sourceStream.getVideoTracks().length || !canvasStream.getVideoTracks().length) {
            finish(); return
          }
          const stream = new env.MediaStream([
            ...canvasStream.getVideoTracks(), ...sourceStream.getAudioTracks(),
          ])
          recorder = new env.MediaRecorder(stream, {
            mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
            audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
          })
          listen(recorder, 'dataavailable', event => { if (event.data?.size) chunks.push(event.data) })
          listen(recorder, 'error', () => finish())
          listen(recorder, 'stop', () => {
            if (settled) return
            try {
              // Et uventet stop må aldrig give en afkortet upload.
              if (!completed) { finish(); return }
              const actualMime = recorder.mimeType.split(';')[0].toLowerCase()
              if (!['video/mp4', 'video/webm'].includes(actualMime)) { finish(); return }
              const result = new env.File(chunks,
                (file.name || 'video').replace(/\.[^.]+$/, '') + (actualMime === 'video/mp4' ? '.mp4' : '.webm'),
                { type: actualMime, lastModified: file.lastModified || Date.now() })
              if (!result.size || result.size >= file.size) { finish(); return }
              progress(100)
              finish(result)
            } catch { finish() }
          })
          listen(video, 'ended', () => {
            if (settled) return
            completed = true
            try {
              recorder.stop()
              later(() => finish(), 5000)
            } catch { finish() }
          })
          useVideoFrames = typeof video.requestVideoFrameCallback === 'function' &&
            typeof video.cancelVideoFrameCallback === 'function'
          const draw = () => {
            if (settled || completed) return
            try {
              context.drawImage(video, 0, 0, canvas.width, canvas.height)
              progress(Math.min(99, Math.floor(video.currentTime / video.duration * 100)))
              frameId = useVideoFrames
                ? video.requestVideoFrameCallback(draw) : env.requestAnimationFrame(draw)
            } catch { finish() }
          }
          const checkAdvance = () => {
            if (settled || completed) return
            if (video.currentTime > lastTime) { lastTime = video.currentTime; lastAdvance = 0 }
            else lastAdvance += 1000
            if (lastAdvance >= 15_000) { finish(); return }
            later(checkAdvance, 1000)
          }
          progress(0)
          recorder.start(1000)
          draw()
          later(checkAdvance, 1000)
          later(() => finish(), video.duration * 2000 + 30_000)
          Promise.resolve(video.play()).catch(() => finish())
        } catch { finish() }
      }
      listen(video, 'loadeddata', begin)
      listen(video, 'canplay', begin)
      objectUrl = env.URL.createObjectURL(file)
      video.src = objectUrl
      video.load()
    } catch { finish() }
  })
}
