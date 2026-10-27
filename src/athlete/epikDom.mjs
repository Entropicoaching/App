// Minimal synthetic DOM/media fixture; never opens a browser or real clip.
export class Element {
  constructor(tag, doc) { this.tagName = tag; this.ownerDocument = doc; this.children = []; this.style = {}; this.dataset = {}; this.attrs = {}; this.listeners = new Map(); this.currentTime = 0; this.paused = true; this.disabled = false; this._text = ''; this.src = '' }
  set textContent(value) { this._text = String(value); this.children = [] }
  get textContent() { return this._text + this.children.map(c => c.textContent).join('') }
  append(...children) { this.children.push(...children); for (const c of children) c.parentNode = this }
  replaceChildren(...children) { this._text = ''; this.children = []; this.append(...children) }
  setAttribute(k, v) { this.attrs[k] = String(v) }
  removeAttribute(k) { delete this.attrs[k]; if (k === 'src') this.src = '' }
  addEventListener(k, f) { if (!this.listeners.has(k)) this.listeners.set(k, new Set()); this.listeners.get(k).add(f) }
  removeEventListener(k, f) { this.listeners.get(k)?.delete(f) }
  async fire(k, target = this) { if (this.disabled && k === 'click') return; for (const f of this.listeners.get(k) || []) await f({ target }); if (k === 'click' && this.parentNode) await this.parentNode.fire(k, target) }
  pause() { this.paused = true }
  load() { this.currentTime = 0; this.duration = NaN; this.videoWidth = 0; this.videoHeight = 0 }
}
export const document = { createElement: tag => new Element(tag, document), createElementNS: (_, tag) => new Element(tag, document) }
export function walk(root, tag) { return [...(root.tagName === tag ? [root] : []), ...root.children.flatMap(c => walk(c, tag))] }
export function h(type, props, _unused, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } } }
export const s = new Proxy({}, { get: () => ({}) })
export const today = () => '2026-10-27'
export const VIDEOCOACH_LIFT_LABELS = { squat: 'Squat' }
export const videoCoachVariationLabel = () => 'Normal'
export const videoCoachPersonalBaselineForAnalysis = () => null
export const videoCoachPersonalBaselineAthleteText = () => ''
export const athleteVideoPathPreview = () => null
export const supabase = new Proxy({}, { get() { throw Error('Real backend forbidden') } })
export const runGuardedWrite = () => { throw Error('Write forbidden') }
export const runGuardedRead = () => { throw Error('Read forbidden') }
export const recordSilentFail = () => { throw Error('Write forbidden') }
export const logFrontendError = () => {}
export const ugeBesked = () => ''
export const parseInputNumber = Number
export const formatMessageTime = () => ''
// Wrapper hooks exercised independently with a synthetic host.
export let effect
export let host
export function useRef() { return { current: host } }
export function useEffect(fn) { effect = fn }
export function createElement(type, props, ...children) { return { type, props: { ...props, children } } }
export function setHost(value) { host = value }
