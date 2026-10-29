// Re-encode only the selected playback interval, without a server or dependency.
// The caller must validate the returned file's decoded duration before upload.
export const compressionProfile = Object.freeze({ videoBitsPerSecond: 1000000, audioBitsPerSecond: 64000 });
export function estimateVideoBytes(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 15) throw Error('Ugyldig varighed');
  return Math.ceil(seconds * (compressionProfile.videoBitsPerSecond + compressionProfile.audioBitsPerSecond) / 8);
}
export function dimensions540(width, height) {
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) throw Error('Ugyldige videomaal');
  const scale = Math.min(1, 540 / height, 960 / width);
  return { width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2) };
}
export function compressVideo2({ video, start, end, media, clock, signal }) {
  return new Promise((resolve, reject) => {
    let recorder, stream, sourceStream, drawTimer = null, timer = null, poll = null, started = false, reachedEnd = false, finished = false;
    const chunks = [];
    if (![start, end, video.duration].every(Number.isFinite) || start < 0 || end <= start || end > video.duration || end - start > 15) {
      reject(Error('Ugyldigt klippeinterval')); return;
    }
    const cleanup = () => {
      if (timer !== null) clock.clear(timer);
      if (poll !== null) clock.clear(poll);
      if (drawTimer !== null) clock.clear(drawTimer);
      video.pause();
      video.removeEventListener('seeked', seeked);
      video.removeEventListener('timeupdate', progress);
      video.removeEventListener('ended', ended);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
      if (recorder) {
        recorder.onstart = recorder.onstop = recorder.onerror = recorder.ondataavailable = null;
        if (recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
      }
      const tracks = new Set([...(stream?.getTracks() || []), ...(sourceStream?.getTracks() || [])]);
      tracks.forEach(track => track.stop());
    };
    const finish = (error, file) => {
      if (finished) return;
      finished = true; cleanup();
      if (error) reject(error); else resolve(file);
    };
    const failed = () => finish(Error('Videoen kunne ikke klippes.'));
    const aborted = () => finish(Error('Klipningen blev afbrudt.'));
    const stop = () => {
      if (!started || finished) return;
      reachedEnd = true; started = false; video.pause();
      try { recorder.stop(); } catch { failed(); }
    };
    const progress = () => { if (video.currentTime >= end) stop(); };
    const ended = () => { if (video.currentTime >= end) stop(); else failed(); };
    const seeked = async () => {
      if (finished || recorder) return;
      try {
        if (Math.abs(video.currentTime - start) > 0.05) throw Error('seek');
        const capture = video.captureStream || video.mozCaptureStream;
        if (!capture) {
          finish(Error('Denne browser kan ikke klippe video. Klip i telefonens editor, og vælg den korte fil.'));
          return;
        }
        video.playbackRate = 1;
        sourceStream = capture.call(video);
        const canvas = media.canvas();
        Object.assign(canvas, dimensions540(video.videoWidth, video.videoHeight));
        const context = canvas.getContext('2d');
        if (!context || !canvas.captureStream) throw Error('canvas');
        stream = canvas.captureStream(30);
        for (const track of sourceStream.getAudioTracks()) stream.addTrack(track);
        const draw = () => {
          if (finished) return;
          try { context.drawImage(video, 0, 0, canvas.width, canvas.height); }
          catch { failed(); return; }
          drawTimer = clock.timeout(draw, 1000 / 30);
        };
        draw();
        if (finished) return;
        if (!stream.getVideoTracks().some(track => track.readyState !== 'ended')) throw Error('tracks');
        recorder = media.recorder(stream, compressionProfile);
        recorder.ondataavailable = event => { if (!finished && event.data?.size) chunks.push(event.data); };
        recorder.onerror = failed;
        recorder.onstop = () => {
          if (!reachedEnd || video.currentTime < end || !chunks.length) { failed(); return; }
          try { finish(null, media.file(chunks, recorder.mimeType || chunks[0].type || 'video/webm')); }
          catch { failed(); }
        };
        recorder.onstart = async () => {
          if (finished) return;
          started = true;
          const check = () => {
            if (finished || !started) return;
            progress();
            if (started && !finished) poll = clock.timeout(check, 20);
          };
          check();
          // Playback position decides the interval; timeout only aborts stalled media.
          try { await video.play(); } catch { failed(); }
        };
        recorder.start();
      } catch { failed(); }
    };
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener('abort', aborted, { once: true });
    video.addEventListener('seeked', seeked);
    video.addEventListener('timeupdate', progress);
    video.addEventListener('ended', ended);
    video.addEventListener('error', failed);
    timer = clock.timeout(failed, (end - start) * 1000 + 15000);
    video.pause();
    try {
      if (video.currentTime === start && !video.seeking) void seeked();
      else video.currentTime = start;
    } catch { failed(); }
  });
}
