import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { jsx } from './reviewJsx.mjs'
const dom = new URL('./reviewDom.mjs', import.meta.url).href
const stub = `export const markerRepliesEnabled=()=>false; export const markerReplyPreview=()=>null;
export const DEFAULT_VIDEOCOACH_FORENKL4=false;
export const s={modal:{}}; export const VIDEOCOACH_STATUS={draft:{},coach_approved:{},shared:{},invalid:{}};
export const VIDEOCOACH_METRICS=[]; export const VIDEOCOACH_LIFT_LABELS={};
export const videoCoachPathPreview=()=>null;
export const sanitizeVideoCoachFeedbackEvidence=()=>null;
export const videoCoachPersonalBaselineOptions=()=>[];
export const videoCoachPersonalBaselineForAnalysis=()=>null;
export const videoCoachFeedbackQuality=()=>({canShare:false,blockers:[]});
export const videoCoachBaselineReviewImpact=()=>null;
export const videoCoachVariationLabel=()=>'';
export const videoCoachMetric=()=>null; export const videoCoachBaseline=()=>null;
export const videoCoachMetricText=()=>''; export const videoCoachBaselineText=()=>'';
import {createElement as h} from 'react'; export const CoachFold=({children})=>h('div',null,children);
export const ReviewConclusion=()=>null; export default ()=>null;`
const allowed = ['./VideoReviewTemplates.mjs','./videoReviewLayout.mjs','./VideoMarkerTemplates.mjs','../athlete/videoFeedbackPlayback.mjs']
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '../athlete/videoFeedbackPlayback.mjs') return {url:new URL(existsSync(new URL('./videoFeedbackPlayback.mjs',import.meta.url)) ? './videoFeedbackPlayback.mjs' : '../athlete/videoFeedbackPlayback.mjs',import.meta.url).href,shortCircuit:true}
    if (specifier === 'react') return {url:dom,shortCircuit:true}
    if ((context.parentURL?.endsWith('/VideoReviewModal.jsx') || context.parentURL?.endsWith('/reviewBaseline.jsx')) && specifier.startsWith('.') && !allowed.includes(specifier)) {
      return {url:'data:text/javascript,'+encodeURIComponent(stub),shortCircuit:true}
    }
    return next(specifier,context)
  },
  load(url,context,next) {
    if ((url.endsWith('/VideoReviewModal.jsx') || url.endsWith('/reviewBaseline.jsx'))) return {format:'module',source:`import { createElement as __h } from '${dom}';\n${jsx(readFileSync(new URL(url),'utf8'))}`,shortCircuit:true}
    return next(url,context)
  }
})
