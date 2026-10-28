import { compressVideo2, estimateVideoBytes, compressionProfile } from './videoCompression2.mjs';
// VC-OPTAG2. Kun et eksplicit kodevalg aktiverer forslaget.
export const DEFAULT_VIDEO_OPTAG2 = false;
export const MAX_CAPTURE_SECONDS = 60;

export function validInterval(start, end, duration) {
  return [start, end, duration].every(Number.isFinite) && start >= 0 &&
    end > start && end <= duration && end - start <= MAX_CAPTURE_SECONDS;
}

// Ingen medie- eller DOM-adgang ved import eller med flaget fra.
export function mountVideoOptag2({ videoOptag2 = DEFAULT_VIDEO_OPTAG2, athlete = false,
  document, onReady, onPending, onCancel = () => {}, media = null, clock = null }) {
  if (videoOptag2 !== true || athlete !== true) return null;
  media ??= {
    getStream: () => navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', height: { ideal: 540, max: 540 } }, audio: true }),
    recorder: (stream, options) => new MediaRecorder(stream, options),
    canvas: () => document.createElement('canvas'),
    file: (chunks, type) => new File(chunks, type.includes('mp4') ? 'loeft.mp4' : 'loeft.webm', { type }),
    url: file => URL.createObjectURL(file),
    revoke: url => URL.revokeObjectURL(url),
  };
  clock ??= { now: () => performance.now(),
    timeout: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) };
  const make = (tag, text, parent) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    parent?.appendChild(node);
    return node;
  };
  const launcher = make('button', 'Optag et løft (højst 60 sekunder)');
  launcher.type = 'button';
  (document.getElementById('openSmall')?.parentNode || document.body).appendChild(launcher);
  const sizeLine = make('p', '', launcher.parentNode);
  sizeLine.setAttribute('role', 'status');
  const panel = make('section', '', document.body);
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Kort løftevideo');
  panel.style.cssText = 'position:fixed;inset:8px;z-index:100000;background:#181818;color:white;padding:16px;overflow:auto';
  make('p', 'Film ét løft pr. video. Optagelsen stopper efter 60 sekunder.', panel);
  const status = make('p', '', panel);
  status.setAttribute('role', 'status');
  const preview = make('video', '', panel);
  preview.controls = true;
  preview.muted = true;
  preview.playsInline = true;
  preview.style.cssText = 'width:100%;max-height:50vh';
  const record = make('button', 'Start optagelse', panel);
  const stop = make('button', 'Stop optagelse', panel);
  const choose = make('button', 'Vælg video fra telefonen', panel);
  const startLabel = make('label', 'Start (sekunder)', panel);
  const start = make('input', '', startLabel);
  const endLabel = make('label', 'Slut (sekunder)', panel);
  const end = make('input', '', endLabel);
  for (const input of [start, end]) {
    input.type = 'number'; input.min = '0'; input.step = '0.1';
  }
  const play = make('button', 'Se valgt interval', panel);
  const trim = make('button', 'Klip og brug video', panel);
  const close = make('button', 'Annullér', panel);
  for (const node of [record, stop, choose, play, trim, close]) {
    node.type = 'button'; node.style.cssText = 'min-height:44px;margin:4px';
  }
  let captureStoppedAt = null;
  let generation = 0, disposed = false, approved = null, stream = null;
  let recorder = null, timer = null, metadataTimer = null, url = null, duration = null;
  let cancelMetadata = null, recording = false, waiting = false, clipAbort = null;
  const clearTimer = () => { if (timer !== null) clock.clear(timer); timer = null; };
  const releaseStream = () => {
    stream?.getTracks().forEach(track => track.stop()); stream = null;
    preview.srcObject = null;
  };
  const clearPreview = () => {
    preview.pause(); preview.onloadedmetadata = null; preview.onerror = null;
    preview.ontimeupdate = null;
    if (metadataTimer !== null) clock.clear(metadataTimer);
    metadataTimer = null;
    cancelMetadata?.(); cancelMetadata = null;
    preview.removeAttribute('src');
    if (url) media.revoke(url);
    url = null; duration = null;
  };
  const controls = () => {
    trim.disabled = play.disabled = waiting || recording;
    record.disabled = waiting || recording;
    choose.disabled = waiting || recording;
    stop.disabled = !recording;
    startLabel.hidden = endLabel.hidden = play.hidden = trim.hidden = !(duration > MAX_CAPTURE_SECONDS);
  };
  const reset = () => {
    clipAbort?.abort(); clipAbort = null;
    generation++; approved = null; sizeLine.textContent = ''; waiting = false; recording = false;
    clearTimer();
    if (recorder) {
      recorder.onstop = recorder.ondataavailable = recorder.onerror = recorder.onstart = null;
      if (recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
      recorder = null;
    }
    releaseStream(); clearPreview(); controls();
  };
  const open = () => { panel.hidden = false; close.focus(); };
  const fail = text => { approved = null; sizeLine.textContent = ''; waiting = false; recording = false; clearTimer(); releaseStream(); status.textContent = text; controls(); };
  async function select(file, encoded = false, expectedSeconds = null) {
    if (disposed || !file) return;
    reset(); onPending(); open();
    const token = generation;
    waiting = true; controls(); status.textContent = 'Læser videoens længde ...';
    try {
      url = media.url(file);
      const seconds = await new Promise((resolve, reject) => {
        cancelMetadata = () => reject(Error('cancelled'));
        preview.onloadedmetadata = () => resolve(preview.duration);
        preview.onerror = () => reject(Error('metadata'));
        metadataTimer = clock.timeout(() => reject(Error('timeout')), 10000);
        preview.src = url;
      });
      if (disposed || token !== generation) return;
      if (metadataTimer !== null) clock.clear(metadataTimer);
      metadataTimer = null; cancelMetadata = null;
      preview.onloadedmetadata = preview.onerror = null;
      waiting = false;
      if (!Number.isFinite(seconds) || seconds <= 0) throw Error('duration');
      // Re-decode raw captures and encoded intervals; never trust Blob size alone.
      if ((encoded || expectedSeconds !== null) &&
          (!Number.isFinite(expectedSeconds) || expectedSeconds <= 0 || Math.abs(seconds - expectedSeconds) > 0.5))
        throw Error('incomplete-duration');
      duration = seconds;
      sizeLine.textContent = '';
      if (seconds <= MAX_CAPTURE_SECONDS)
        sizeLine.textContent = `Forventet størrelse: ${(estimateVideoBytes(seconds) / 1000000).toFixed(1)} MB (540p, ca. 1 Mbit/s).`;
      if (seconds <= MAX_CAPTURE_SECONDS) {
        if (encoded) {
          if (!file.size || !/^video\//.test(file.type || '') ||
              !Number.isFinite(preview.videoHeight) || preview.videoHeight <= 0 || preview.videoHeight > 540 ||
              !Number.isFinite(preview.videoWidth) || preview.videoWidth <= 0 || preview.videoWidth > 960)
            throw Error('encoded-output');
          approved = file;
          sizeLine.textContent = `Forventet størrelse: ${(estimateVideoBytes(seconds) / 1000000).toFixed(1)} MB (540p, ca. 1 Mbit/s). Klar til upload.`;
          clearPreview(); panel.hidden = true; launcher.focus(); onReady(file);
        } else {
          await encode(0, seconds);
        }
      } else {
        start.value = ''; end.value = '';
        start.max = end.max = String(seconds);
        status.textContent = 'Videoen er over 60 sekunder. Vælg start og slut, og tryk Klip og brug video. Klipning og komprimering tager intervallets tid. Intet er sendt.';
      }
      controls();
    } catch {
      if (disposed || token !== generation) return;
      clearPreview(); fail('Videoens længde kunne ikke læses. Vælg en anden video.');
    }
  }
  function stopRecording() {
    if (!recording || !recorder) return;
    captureStoppedAt = clock.now();
    recording = false; waiting = true; clearTimer(); controls();
    status.textContent = 'Optagelsen er stoppet. Kontrollerer længden ...';
    try { recorder.stop(); } catch { fail('Optagelsen kunne ikke gemmes. Prøv igen.'); }
    releaseStream();
  }
  async function beginRecording() {
    if (disposed || waiting || recording) return;
    reset(); onPending(); open();
    const token = generation;
    waiting = true; controls(); status.textContent = 'Åbner kameraet ...';
    try {
      const acquired = await media.getStream();
      if (disposed || token !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream = acquired; preview.srcObject = stream;
      await preview.play();
      if (disposed || token !== generation) return;
      const active = media.recorder(stream, compressionProfile), chunks = [];
      let capturedAt = null, capturedSeconds = null;
      recorder = active;
      active.ondataavailable = event => { if (token === generation && event.data?.size) chunks.push(event.data); };
      active.onerror = () => {
        if (token !== generation) return;
        reset(); status.textContent = 'Optagelsen mislykkedes. Prøv igen.';
      };
      active.onstop = () => {
        if (disposed || token !== generation) return;
        capturedSeconds ??= capturedAt === null ? 0 : ((captureStoppedAt ?? clock.now()) - capturedAt) / 1000;
        clearTimer(); releaseStream(); recorder = null;
        if (!chunks.length) { fail('Optagelsen var tom. Prøv igen.'); return; }
        try { void select(media.file(chunks, active.mimeType || chunks[0].type || 'video/webm'), false, capturedSeconds); }
        catch { fail('Optagelsen kunne ikke gemmes. Prøv igen.'); }
      };
      active.onstart = () => {
        if (disposed || token !== generation) return;
        capturedAt = clock.now(); captureStoppedAt = null;
        waiting = false; recording = true; controls();
        const deadline = clock.now() + MAX_CAPTURE_SECONDS * 1000;
        const tick = () => {
          if (!recording || token !== generation) return;
          const remaining = Math.max(0, deadline - clock.now());
          status.textContent = remaining <= 10000 ? `${Math.ceil(remaining / 1000)} sekunder tilbage` : 'Optager ... stopper efter 60 sekunder.';
          if (remaining === 0) { stopRecording(); return; }
          timer = clock.timeout(tick, Math.min(100, remaining));
        };
        tick();
      };
      active.start();
    } catch {
      if (disposed || token !== generation) return;
      reset(); status.textContent = 'Kameraet kunne ikke åbnes. Vælg en video fra telefonen.';
    }
  }
  launcher.onclick = () => { reset(); onPending(); open(); status.textContent = 'Klar til ét løft.'; };
  record.onclick = beginRecording;
  stop.onclick = stopRecording;
  choose.onclick = () => {
    const input = document.getElementById('fileInput');
    if (input) { input.value = ''; input.click(); }
    else status.textContent = 'Filvalg er ikke tilgængeligt her.';
  };
  play.onclick = async () => {
    const from = Number(start.value), to = Number(end.value);
    if (start.value.trim() === '' || end.value.trim() === '' || !validInterval(from, to, duration)) {
      status.textContent = 'Vælg start og slut inden for videoen, højst 60 sekunder.'; return;
    }
    preview.pause(); preview.currentTime = from;
    preview.ontimeupdate = () => { if (preview.currentTime >= to) preview.pause(); };
    try { await preview.play(); } catch { status.textContent = 'Forhåndsvisningen kunne ikke afspilles.'; }
  };
  async function encode(from, to) {
    const token = generation;
    clipAbort = new AbortController();
    waiting = true; controls(); preview.ontimeupdate = null;
    status.textContent = 'Klipper og komprimerer ... Intet er sendt.';
    try {
      const file = await compressVideo2({ video: preview, start: from, end: to, media, clock, signal: clipAbort.signal });
      if (disposed || token !== generation) return;
      clipAbort = null;
      await select(file, true, to - from);
    } catch (error) {
      if (disposed || token !== generation) return;
      clipAbort = null; waiting = false; controls();
      status.textContent = error.message + ' Intet er sendt.';
    }
  }
  trim.onclick = async () => {
    if (disposed || waiting || recording) return;
    const from = Number(start.value), to = Number(end.value);
    if (start.value.trim() === '' || end.value.trim() === '' || !validInterval(from, to, duration)) {
      status.textContent = 'Vælg start og slut inden for videoen, højst 60 sekunder.'; return;
    }
    await encode(from, to);
  };
  start.oninput = end.oninput = () => {
    const from = Number(start.value), to = Number(end.value);
    sizeLine.textContent = start.value.trim() && end.value.trim() && validInterval(from, to, duration)
      ? `Forventet størrelse: ${(estimateVideoBytes(to - from) / 1000000).toFixed(1)} MB (540p, ca. 1 Mbit/s).` : '';
  };
  const cancel = () => { reset(); onPending(); panel.hidden = true; launcher.focus(); onCancel(); };
  close.onclick = cancel;
  panel.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    if (event.key === 'Tab') {
      const focusable = [record, stop, choose, start, end, play, trim, close].filter(node =>
        !node.disabled && !node.hidden && !node.parentNode.hidden);
      const index = focusable.indexOf(document.activeElement);
      event.preventDefault();
      focusable[(index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length].focus();
    }
  };
  const visibility = () => {
    if (!document.hidden) return;
    if (recording) stopRecording();
    else if (waiting) {
      reset(); onPending(); status.textContent = 'Afbrudt, fordi appen blev skjult. Prøv igen.'; onCancel();
    }
  };
  // Bevar bindingen ved tilbage-navigation fra browserens sidecache.
  const leave = () => { reset(); onPending(); panel.hidden = true; onCancel(); };
  const dispose = () => {
    if (disposed) return;
    disposed = true; reset(); launcher.remove(); panel.remove(); sizeLine.remove();
    document.removeEventListener('visibilitychange', visibility);
    document.defaultView?.removeEventListener('pagehide', leave);
  };
  document.addEventListener('visibilitychange', visibility);
  document.defaultView?.addEventListener('pagehide', leave);
  controls();
  return { select: file => select(file), accepts: file => !disposed && approved !== null && file === approved, dispose };
}
