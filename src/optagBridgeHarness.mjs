import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fixture, settle } from './videoOptag2Fakes.mjs';

let sequence = 0;
const local = (flat, app) => new URL(existsSync(new URL(flat, import.meta.url)) ? flat : app, import.meta.url).href;
export async function bridge({ videoOptag2, before = false } = {}) {
  const dom = fixture({ factory: () => null });
  // Real Blob container, synthetic bytes only. Never real media devices.
  let active;
  const media = dom.media;
  media.file = (_, type) => new Blob(['synthetic encoded'], { type });
  const nativeRecorder = media.recorder;
  class Recorder {
    constructor(stream, options) { active = nativeRecorder(stream, options); return active; }
  }
  const nativeCreate = dom.doc.createElement;
  dom.doc.createElement = tag => {
    if (tag === 'canvas') return media.canvas();
    const node = nativeCreate(tag);
    if (tag === 'video') {
      Object.assign(node, { currentTime: 0, seeking: false, videoWidth: 960, videoHeight: 540,
        captureStream: () => ({ getTracks: () => [], getAudioTracks: () => [] }) });
    }
    return node;
  };
  const f = { effects: [], uploads: [], rows: [], replies: [], listeners: {}, dom };
  const replacements = {
    __optagBridge: f, document: dom.doc,
    window: { location: { origin: 'https://synthetic.invalid' },
      addEventListener: (type, fn) => { f.listeners[type] = fn; }, removeEventListener() {}, dispatchEvent() {} },
    localStorage: { getItem: () => null }, MediaRecorder: Recorder,
    navigator: { mediaDevices: { getUserMedia: media.getStream } },
    performance: { now: dom.clock.now },
    File: class extends Blob { constructor(parts, name, options) { super(parts, options); this.name = name; } },
    setTimeout: dom.clock.timeout, clearTimeout: dom.clock.clear,
  };
  const old = Object.fromEntries(Object.keys(replacements).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  for (const [k, value] of Object.entries(replacements)) Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
  const suffix = `?fixture=${++sequence}`;
  const hookUrl = (before ? new URL('./input-400-0399-useVideoCoachBro.js', import.meta.url).href
    : local('./useVideoCoachBro.js', './athlete/useVideoCoachBro.js')) + suffix;
  const real = {
    '../videoOptag2.mjs': './videoOptag2.mjs',
    '../videoOptag2Upload.mjs': './videoOptag2Upload.mjs',
    './videoSetSelection.mjs': existsSync(new URL('./videoSetSelection.mjs', import.meta.url)) ? './videoSetSelection.mjs' : './athlete/videoSetSelection.mjs',
    '../videoUploadRetry.mjs': './videoUploadRetry.mjs',
    '../videoCoachUpload': './videoCoachUpload.js',
  };
  const stubSpecs = new Set(['react', '../supabase', '../videoCoachFeedbackEvidence',
    '../athleteSilentFailLog', '../videoCoachSubmission', './videoCoachBro']);
  const hooks = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === hookUrl) {
      if (real[specifier]) return next(new URL(real[specifier], import.meta.url).href, context);
      if (stubSpecs.has(specifier)) return next(new URL('./optagBridgeStubs.mjs', import.meta.url).href + suffix, context);
      throw Error('Unpinned dependency: ' + specifier);
    }
    if (context.parentURL?.endsWith('/videoSetSelection.mjs') && specifier === '../calendarDate.js')
      return next(new URL('./calendarDate.js', import.meta.url).href, context);
    if (context.parentURL?.endsWith('/calendarDate.js') && specifier === './athlete/kostNumbers.mjs')
      return next(local('./kostNumbers.mjs', './athlete/kostNumbers.mjs'), context);
    return next(specifier, context);
  } });
  try {
    const module = await import(hookUrl);
    const athlete = { id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic' };
    const client = { postMessage: message => f.replies.push(message) };
    f.athleteRef = { current: athlete }; f.clients = new Set([client]); f.aborts = new Map();
    f.setRef = { current: { enabled: false } };
    module.useVideoCoachBro({ videoOptag2, videoSetRef: f.setRef, athlete,
      athleteVideoCoachClientsRef: { current: f.clients }, athleteVideoCoachFrameRef: { current: null },
      athleteVideoCoachRef: f.athleteRef, athleteVideoUploadAbortsRef: { current: f.aborts },
      flashTimerRef: { current: null }, session: { user: { id: 'synthetic' } },
      setAthleteVideoCoachInstant() {}, setAthleteVideoCoachOpen() {}, setFlash() {} });
    f.cleanup = f.effects[1]();
    f.message = { type: 'test:vc:upload-and-go', requestId: 'attempt',
      clientAnalysisId: '22222222-2222-4222-8222-222222222222',
      file: new Blob(['synthetic original'], { type: 'video/mp4' }), mimeType: 'video/mp4',
      lift: 'squat', variation: 'competition' };
    f.send = (message = f.message, origin = 'https://synthetic.invalid', source = client) =>
      f.listeners.message({ data: message, origin, source });
    f.preview = () => dom.nodes.filter(n => n.tag === 'video' && !n.removed).at(-1);
    f.metadata = async seconds => { await new Promise(setImmediate); const p = f.preview(); p.duration = seconds; p.onloadedmetadata?.(); await settle(); };
    f.finish = async (end, duration = end) => {
      const p = f.preview(); p.emit('seeked'); await settle();
      p.currentTime = end; p.emit('timeupdate'); await settle(); await f.metadata(duration);
    };
    f.button = text => dom.nodes.filter(n => n.tag === 'button' && !n.removed && n.textContent === text).at(-1);
    f.recorder = () => active;
    f.restore = () => {
      f.cleanup?.(); hooks.deregister();
      for (const [k, desc] of Object.entries(old)) { if (desc) Object.defineProperty(globalThis, k, desc); else delete globalThis[k]; }
    };
    return f;
  } catch (error) {
    hooks.deregister();
    for (const [k, desc] of Object.entries(old)) { if (desc) Object.defineProperty(globalThis, k, desc); else delete globalThis[k]; }
    throw error;
  }
}
