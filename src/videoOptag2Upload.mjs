import { mountVideoOptag2, DEFAULT_VIDEO_OPTAG2 } from './videoOptag2.mjs';

// One preparation dialog per document. Only validated output leaves this gate.
const active = new WeakMap();
export function prepareVideoOptag2Upload(file, { videoOptag2 = DEFAULT_VIDEO_OPTAG2,
  document, signal, media, clock } = {}) {
  if (videoOptag2 !== true) return Promise.resolve(file);
  return new Promise((resolve, reject) => {
    let api, done = false;
    const finish = (error, output) => {
      if (done) return;
      done = true;
      signal?.removeEventListener('abort', cancel);
      api?.dispose();
      if (active.get(document) === cancel) active.delete(document);
      if (error) reject(error); else resolve(output);
    };
    const cancel = () => finish(Error('Videoklargoring afbrudt. Intet er sendt.'));
    if (signal?.aborted) { cancel(); return; }
    try {
      active.get(document)?.();
      active.set(document, cancel);
      api = mountVideoOptag2({ videoOptag2: true, athlete: true, document, media, clock,
        onPending() {}, onCancel: cancel,
        onReady(output) {
          if (!api.accepts(output)) { cancel(); return; }
          finish(null, output);
        } });
      signal?.addEventListener('abort', cancel, { once: true });
      void api.select(file).catch(error => finish(error));
    } catch (error) { finish(error); }
  });
}
