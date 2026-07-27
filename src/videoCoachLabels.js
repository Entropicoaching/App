export const VIDEOCOACH_LIFT_LABELS = {
  squat: 'Squat',
  bench: 'Bænkpres',
  deadlift: 'Dødløft',
}

function variationLookupKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replaceAll('æ', 'ae')
    .replaceAll('ø', 'oe')
    .replaceAll('å', 'aa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const VIDEOCOACH_VARIATION_LABELS = {
  competition_squat: 'Konkurrence squat',
  konkurrence_squat: 'Konkurrence squat',
  low_bar_squat: 'Low-bar squat',
  high_bar_squat: 'High-bar squat',
  pause_squat: 'Pause squat',
  tempo_squat: 'Tempo squat',
  front_squat: 'Front squat',
  safety_bar_squat: 'Safety-bar squat',
  box_squat: 'Box squat',

  competition_bench: 'Konkurrence bænkpres',
  competition_bench_pause: 'Konkurrence bænk (pause)',
  konkurrence_baenk: 'Konkurrence bænkpres',
  konkurrence_baenk_pause: 'Konkurrence bænk (pause)',
  konkurrence_b_nk_pause: 'Konkurrence bænk (pause)',
  touch_and_go_baenk: 'Touch-and-go bænk',
  touch_and_go_b_nk: 'Touch-and-go bænk',
  close_grip_baenk: 'Close-grip bænk',
  close_grip_b_nk: 'Close-grip bænk',
  wide_grip_baenk: 'Wide-grip bænk',
  wide_grip_b_nk: 'Wide-grip bænk',
  spoto_press: 'Spoto press',
  incline_baenk: 'Incline bænk',
  incline_b_nk: 'Incline bænk',

  competition_conventional: 'Konkurrence konventionel',
  konkurrence_konventionel: 'Konkurrence konventionel',
  pause_deadlift: 'Pause deadlift',
  deficit_deadlift: 'Deficit deadlift',
  block_pull: 'Block pull',
  rumaensk_doedloeft: 'Rumænsk dødløft',
  rum_nsk_d_dl_ft: 'Rumænsk dødløft',
  competition_sumo: 'Konkurrence sumo',
  konkurrence_sumo: 'Konkurrence sumo',
  pause_sumo: 'Pause sumo',
  deficit_sumo: 'Deficit sumo',
  sumo_block_pull: 'Sumo block pull',
}

const VIDEOCOACH_VARIATION_IDENTITIES = {
  competition_squat: 'konkurrence_squat',
  konkurrence_squat: 'konkurrence_squat',
  low_bar_squat: 'low_bar_squat',
  high_bar_squat: 'high_bar_squat',
  pause_squat: 'pause_squat',
  tempo_squat: 'tempo_squat',
  front_squat: 'front_squat',
  safety_bar_squat: 'safety_bar_squat',
  box_squat: 'box_squat',

  competition_bench: 'konkurrence_b_nk_pause',
  competition_bench_pause: 'konkurrence_b_nk_pause',
  konkurrence_baenk: 'konkurrence_b_nk_pause',
  konkurrence_baenk_pause: 'konkurrence_b_nk_pause',
  konkurrence_b_nk_pause: 'konkurrence_b_nk_pause',
  touch_and_go_baenk: 'touch_and_go_b_nk',
  touch_and_go_b_nk: 'touch_and_go_b_nk',
  close_grip_baenk: 'close_grip_b_nk',
  close_grip_b_nk: 'close_grip_b_nk',
  wide_grip_baenk: 'wide_grip_b_nk',
  wide_grip_b_nk: 'wide_grip_b_nk',
  spoto_press: 'spoto_press',
  incline_baenk: 'incline_b_nk',
  incline_b_nk: 'incline_b_nk',

  competition_conventional: 'konkurrence_konventionel',
  konkurrence_konventionel: 'konkurrence_konventionel',
  pause_deadlift: 'pause_deadlift',
  deficit_deadlift: 'deficit_deadlift',
  block_pull: 'block_pull',
  rumaensk_doedloeft: 'rum_nsk_d_dl_ft',
  rum_nsk_d_dl_ft: 'rum_nsk_d_dl_ft',
  competition_sumo: 'konkurrence_sumo',
  konkurrence_sumo: 'konkurrence_sumo',
  pause_sumo: 'pause_sumo',
  deficit_sumo: 'deficit_sumo',
  sumo_block_pull: 'sumo_block_pull',
}

export function videoCoachVariationIdentity(lift, variation) {
  const key = variationLookupKey(variation)
  if (!key || key === 'standard') {
    return ({
      squat: 'konkurrence_squat',
      bench: 'konkurrence_b_nk_pause',
      deadlift: 'konkurrence_konventionel',
    })[lift] || 'standard'
  }
  return VIDEOCOACH_VARIATION_IDENTITIES[key] || key
}

export function videoCoachVariationLabel(lift, variation) {
  const key = variationLookupKey(variation)
  if (!key || key === 'standard') return VIDEOCOACH_LIFT_LABELS[lift] || 'Standard'
  const identity = videoCoachVariationIdentity(lift, variation)
  if (VIDEOCOACH_VARIATION_LABELS[key]) return VIDEOCOACH_VARIATION_LABELS[key]
  if (VIDEOCOACH_VARIATION_LABELS[identity]) return VIDEOCOACH_VARIATION_LABELS[identity]
  return String(variation).trim().replaceAll('_', ' ')
}
