import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { jsx } from './selectionJsx.mjs'

const local = (name, app) => new URL(existsSync(new URL(name, import.meta.url)) ? name : app, import.meta.url).href
const hook = local('./useVideoCoachBro.js', './useVideoCoachBro.js')
const ramme = local('./Ramme.jsx', './Ramme.jsx')
const coach = local('./coachVideoHjaelp.js', '../dashboard/coachVideoHjaelp.js')
const upload = local('./videoCoachUpload.js', '../videoCoachUpload.js')
const model = new URL('./videoSetSelection.mjs', import.meta.url).href
const athlete = local('./AthleteView.jsx', '../AthleteView.jsx')
const stub = 'data:text/javascript,' + encodeURIComponent(`
export const useEffect = fn => globalThis.__selectionFixture.effects.push(fn);
export const createElement = (type, props, ...children) => ({type, props: {...props, children}});
export const supabase = {};
export const createAbortableUploadClient = signal => ({storage:{from: bucket => ({upload: async (...args) => {
  const f=globalThis.__selectionFixture; f.uploads.push({signal,bucket,args});
  return f.upload ? f.upload() : {};
}})}});
export const videoUploadRetryEnabled = () => false;
export const uploadVideoAttempt = () => {throw Error('Unexpected retry')};
export const saveVideoCoachDraft = async (_, row) => {globalThis.__selectionFixture.rows.push(row); return {data:{id:'saved'}}};
export const sanitizeVideoCoachFeedbackEvidence = x => x;
export const attachPendingSilentFails = x => x;
export const recordSilentFail = () => {};
export const clearPendingSilentFails = () => {};
export const markUploadInflight = () => {};
export const clearUploadInflight = () => {};
export const takeStaleUploadInflight = () => false;
export const flushVideoCoachDraftQueue = async () => ({remaining:0});
export const isRetryableVideoCoachError = () => false;
export const queueVideoCoachDraft = () => false;
export const ATHLETE_VIDEOCOACH_PREFIX = 'test:vc';
export const ATHLETE_VIDEOCOACH_QUEUE_CHANGED = 'test:queue';
export const ATHLETE_VIDEOCOACH_URL = 'synthetic.html';
export const validateAthleteVideoCoachRow = () => null;
export const validateVideoCoachPayloadBounds = () => null;
export const withDataEnoughFlag = x => x;
export const withVideoCoachPersonalBaseline = x => x;
export const VIDEOCOACH_LIFT_LABELS = {squat:'Squat',bench:'Bænkpres',deadlift:'Dødløft'};
export const videoCoachVariationLabel = () => 'Competition';
export const VIDEOCOACH_BUILD_ID = 'synthetic';
export const s = new Proxy({}, {get:()=>({})});
export const today = () => '2026-10-27';
export const signOutHard = () => {throw Error('Forbidden')};
export const countOfflineSets = () => 0;
`)

export function install() {
  return registerHooks({
    resolve(spec, context, next) {
      if ([hook, ramme, coach].includes(context.parentURL)) {
        if (spec === (context.parentURL === coach ? '../athlete/videoSetSelection.mjs' : './videoSetSelection.mjs')) return {url:model, shortCircuit:true}
        if (spec === '../videoCoachUpload') return {url:upload, shortCircuit:true}
        const allowed = context.parentURL === hook
          ? ['react','../videoUploadRetry.mjs','../supabase','../videoCoachFeedbackEvidence',
             '../athleteSilentFailLog','../videoCoachSubmission','./videoCoachBro']
          : context.parentURL === ramme
            ? ['react','../supabase','../offlineSetQueue','../athleteShared','./videoCoachBro']
            : ['../dataEnough.mjs','../videoCoachSubmission.js','../videoCoachPersonalFeedback.js',
               '../videoCoachLabels.js','../videoCoachVersion.js']
        if (!(context.parentURL === ramme && spec === stub) && !allowed.includes(spec)) throw Error('Unlisted synthetic dependency: ' + spec)
        return {url:stub, shortCircuit:true}
      }
      if (context.parentURL === model && spec === '../calendarDate.js')
        return {url:local('./calendarDate.js', '../calendarDate.js'),shortCircuit:true}
      if (context.parentURL === new URL('./calendarDate.js',import.meta.url).href && spec === './athlete/kostNumbers.mjs')
        return {url:new URL('./kostNumbers.mjs',import.meta.url).href,shortCircuit:true}
      return next(spec, context)
    },
    load(url, context, next) {
      if (url === ramme || url === athlete) return {format:'module', source:
        `import {createElement as __h0} from ${JSON.stringify(stub)};\nconst __h=(t,p,_,...c)=>__h0(t,p,...c);\n` + jsx(readFileSync(new URL(url),'utf8')), shortCircuit:true}
      return next(url, context)
    },
  })
}

// Parse the exact parent JSX without executing its unrelated application effects.
export function checkAthleteSyntax() {
  const source = jsx(readFileSync(new URL(athlete), 'utf8'))
    .replace(/^import\s+[\s\S]*?\sfrom\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace('export default function AthleteView', 'function AthleteView')
  return new Function(source)
}

export async function modules() {
  return { hook: await import(hook), Ramme: (await import(ramme)).default, coach: await import(coach) }
}
export const h = (type, props, ...children) => ({type, props:{...props, children}})
export function nodes(root, type) {
  if (!root || typeof root !== 'object') return []
  if (Array.isArray(root)) return root.flatMap(row => nodes(row,type))
  return [...(root.type===type ? [root] : []), ...nodes(root.props?.children,type)]
}
export async function bridge(module, state) {
  const f = {effects:[], rows:[], uploads:[], replies:[], listeners:{}}
  const oldWindow = globalThis.window
  const oldFixture = globalThis.__selectionFixture
  globalThis.__selectionFixture = f
  globalThis.window = {location:{origin:'https://synthetic.invalid'},
    addEventListener: (name,fn) => {f.listeners[name]=fn}, removeEventListener() {}, dispatchEvent() {}}
  const athlete = {id:'11111111-1111-4111-8111-111111111111', name:'Synthetic'}
  const client = {postMessage: data => f.replies.push(data)}
  f.ref = {current:state}
  module.useVideoCoachBro({videoSetRef:f.ref, athlete, athleteVideoCoachRef:{current:athlete},
    athleteVideoCoachClientsRef:{current:new Set([client])}, athleteVideoCoachFrameRef:{current:null},
    athleteVideoUploadAbortsRef:{current:new Map()}, flashTimerRef:{current:null},
    session:{user:{id:'synthetic'}}, setAthleteVideoCoachInstant(){}, setAthleteVideoCoachOpen(){}, setFlash(){}})
  f.effects[1]()
  f.message = {type:'test:vc:upload-and-go', requestId:'synthetic',
    clientAnalysisId:'22222222-2222-4222-8222-222222222222',
    file:new Blob(['synthetic'],{type:'video/mp4'}), mimeType:'video/mp4', lift:'squat', variation:'competition'}
  f.send = (data=f.message, origin=window.location.origin, source=client) => f.listeners.message({data,origin,source})
  f.restore = () => {globalThis.window=oldWindow; globalThis.__selectionFixture=oldFixture}
  return f
}
