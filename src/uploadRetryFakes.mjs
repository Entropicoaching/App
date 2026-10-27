import { readFileSync, existsSync } from 'node:fs'

export const localOrApp = (local, app) => new URL(
  existsSync(new URL(local, import.meta.url)) ? local : app, import.meta.url)
export const ui = await import(localOrApp('./vcUploadRetry.mjs', '../public/vcUploadRetry.mjs'))

export function dom() {
  const elements = []
  const document = { createElement(tag) {
    const el = { tag, hidden: false, disabled: false, style: {}, children: [], attrs: {},
      append(...children) { this.children.push(...children) },
      setAttribute(k, v) { this.attrs[k] = v } }
    elements.push(el)
    return el
  } }
  document.body = document.createElement('body')
  return { document, elements }
}

// Import the actual hook with only its external dependencies replaced. No JSX,
// backend, real storage, real timers, React runtime, or browser is needed.
export async function bridge({ enabled = true, upload = async () => ({}), save = async () => ({ data: { id: 'synthetic' } }) } = {}) {
  const f = { effects: [], replies: [], uploads: [], rows: [], markers: [], listeners: {},
    storage: { getItem: () => enabled ? '1' : null } }
  const stub = `
    const f = globalThis.__vcUploadTest;
    export const useEffect = effect => f.effects.push(effect);
    export const supabase = {};
    export const createAbortableUploadClient = signal => ({storage:{from: bucket => ({upload: (path,file,options) => { f.uploads.push({signal,bucket,path,file,options}); return f.upload(signal,path,file); }})}});
    export const sanitizeVideoCoachFeedbackEvidence = x => x;
    export const recordSilentFail = () => {};
    export const attachPendingSilentFails = x => x;
    export const clearPendingSilentFails = () => {};
    export const markUploadInflight = (...x) => f.markers.push(['mark',...x]);
    export const clearUploadInflight = (...x) => f.markers.push(['clear',...x]);
    export const takeStaleUploadInflight = () => false;
    export const flushVideoCoachDraftQueue = async () => ({remaining:0});
    export const isRetryableVideoCoachError = () => false;
    export const queueVideoCoachDraft = () => false;
    export const saveVideoCoachDraft = async (client,row) => { f.rows.push(row); return f.save(row); };
    export const ATHLETE_VIDEOCOACH_PREFIX = 'test:vc';
    export const ATHLETE_VIDEOCOACH_QUEUE_CHANGED = 'test:queue';
    export const validateAthleteVideoCoachRow = () => null;
  `
  const stubUrl = 'data:text/javascript;base64,' + Buffer.from(stub).toString('base64') + '#' + Math.random()
  let source = readFileSync(localOrApp('./useVideoCoachBro.js', './athlete/useVideoCoachBro.js'), 'utf8')
  source = source.replace(/from '([^']+)'/g, (_, spec) => {
    const url = spec === '../videoUploadRetry.mjs' ? new URL('./videoUploadRetry.mjs', import.meta.url).href
      : spec === '../videoCoachUpload' ? new URL('./videoCoachUpload.js', import.meta.url).href : stubUrl
    return `from '${url}'`
  })
  f.upload = upload
  f.save = save
  const old = { window: globalThis.window, localStorage: globalThis.localStorage, fixture: globalThis.__vcUploadTest }
  globalThis.__vcUploadTest = f
  globalThis.localStorage = f.storage
  globalThis.window = { location: { origin: 'https://synthetic.invalid' },
    addEventListener: (type, fn) => { f.listeners[type] = fn },
    removeEventListener() {}, dispatchEvent() {} }
  const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#' + Math.random())
  const athlete = { id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic' }
  const client = { postMessage: data => f.replies.push(data) }
  f.aborts = new Map()
  module.useVideoCoachBro({ athlete, athleteVideoCoachClientsRef: { current: new Set([client]) },
    athleteVideoCoachFrameRef: { current: null }, athleteVideoCoachRef: { current: athlete },
    athleteVideoUploadAbortsRef: { current: f.aborts }, flashTimerRef: { current: null },
    session: { user: { id: 'synthetic-user' } }, setAthleteVideoCoachInstant() {},
    setAthleteVideoCoachOpen() {}, setFlash() {} })
  f.effects[1]()
  f.message = { type: 'test:vc:upload-and-go', requestId: 'attempt1',
    clientAnalysisId: '22222222-2222-4222-8222-222222222222',
    file: new Blob(['synthetic video'], { type: 'video/mp4' }), mimeType: 'video/mp4',
    lift: 'squat', variation: 'competition' }
  f.send = (message = f.message, origin = 'https://synthetic.invalid', source = client) => f.listeners.message({ origin, source, data: message })
  f.restore = () => { globalThis.window = old.window; globalThis.localStorage = old.localStorage; globalThis.__vcUploadTest = old.fixture }
  return f
}
