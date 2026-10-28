import { mountVideoOptag2 } from './videoOptag2.mjs';

export function fixture(options = {}) {
  const nodes = [], listeners = new Map(), jobs = new Map();
  let now = 0, next = 0, trackStops = 0, stops = 0, pending = 0;
  const ready = [], revoked = [];
  const doc = {
    hidden: false,
    defaultView: {
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); },
    },
    createElement(tag) {
      const events = new Map();
      const node = { addEventListener(k, fn) { events.set(k, fn); },
        removeEventListener(k) { events.delete(k); },
        emit(k) { events.get(k)?.(); }, tag, children: [], style: {}, hidden: false, disabled: false, value: '',
        appendChild(child) { this.children.push(child); child.parentNode = this; },
        setAttribute(key, value) { this[key] = value; },
        removeAttribute(key) { delete this[key]; },
        remove() { this.removed = true; },
        focus() { doc.activeElement = this; },
        pause() { this.paused = true; },
        async play() { this.paused = false; },
        click() { if (!this.disabled) return this.onclick?.(); },
      };
      nodes.push(node); return node;
    },
    getElementById(id) { return id === 'fileInput' ? input : null; },
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
  };
  doc.body = doc.createElement('body');
  const input = doc.createElement('input'); input.click = () => { input.clicked = true; };
  let active;
  const track = { readyState: 'live', stop() { trackStops++; } };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [], addTrack() {} };
  const media = {
    async getStream() { return stream; },
    recorder() {
      active = { state: 'inactive', mimeType: 'video/webm',
        start() { this.state = 'recording'; this.onstart(); },
        stop() { stops++; this.state = 'inactive'; this.ondataavailable?.({ data: { size: 3 } }); this.onstop?.(); },
      };
      return active;
    },
    file: () => ({ size: 3, name: 'recorded.webm', type: 'video/webm' }),
    canvas: () => ({ getContext: () => ({ drawImage() {} }), captureStream: () => stream }),
    url: file => `blob:${file.name}`,
    revoke: url => revoked.push(url),
    ...options.media,
  };
  const clock = { now: () => now,
    timeout(fn, ms) { const id = ++next; jobs.set(id, { fn, at: now + ms }); return id; },
    clear(id) { jobs.delete(id); },
  };
  const api = (options.factory || mountVideoOptag2)({ videoOptag2: true, athlete: true, document: doc,
    onReady: file => ready.push(file), onPending: () => pending++, media, clock, ...options.mount });
  const button = text => nodes.find(node => node.tag === 'button' && node.textContent === text);
  const preview = nodes.find(node => node.tag === 'video');
  if (preview) { preview.currentTime = 0; preview.seeking = false; preview.videoWidth = 1920; preview.videoHeight = 1080; preview.captureStream = () => stream; }
  const fields = nodes.filter(node => node.type === 'number');
  return { api, doc, nodes, button, preview, fields, ready, revoked, jobs, media, clock, input,
    get active() { return active; }, get stops() { return stops; },
    get trackStops() { return trackStops; }, get pending() { return pending; },
    advance(ms) {
      const target = now + ms;
      while (true) {
        const first = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (!first || first[1].at > target) break;
        now = first[1].at; jobs.delete(first[0]); first[1].fn();
      }
      now = target;
    },
    jump(ms) { now += ms; const work = [...jobs]; jobs.clear(); work.forEach(([, job]) => job.fn()); },
    async metadata(seconds) { preview.duration = seconds; preview.videoWidth = 960; preview.videoHeight = 540; preview.onloadedmetadata?.(); await settle(); },
    hide() { doc.hidden = true; listeners.get('visibilitychange')?.(); },
    leave() { listeners.get('pagehide')?.(); },
  };
}
export async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

