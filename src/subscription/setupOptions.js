// Valgene i setup — én kilde for baade setup-skaermen og profilsiden.
//
// De laa i MemberJourney.jsx. Da profilsiden skulle vise de SAMME valg, gav det
// en cirkulaer import (MemberJourney -> PilotProfile -> MemberJourney). To
// haandskrevne lister ville have loest cirklen og skabt et vaerre problem: de
// ville drive fra hinanden uden at nogen opdagede det.
export const DAYS = [2, 3, 4].map(value => ({ value, label: `${value} træningsdage om ugen` }))

export const EQUIPMENT = [
  { value: 'gym', label: 'Full Gym', note: 'Stang, skiver, rack, bænk og almindelige maskiner.' },
  { value: 'home', label: 'Hjemmetræning', note: 'Kræver håndvægte, en stabil bænk eller kasse og en elastik.' },
]

export const SQUAT_STYLES = [
  { value: 'high-bar', label: 'High-bar squat' },
  { value: 'low-bar', label: 'Low-bar squat' },
]

export const DEADLIFT_STYLES = [
  { value: 'conventional', label: 'Konventionel dødløft' },
  { value: 'sumo', label: 'Sumo dødløft' },
]

export const DAY_LABEL = Object.fromEntries(DAYS.map(d => [d.value, d.label]))
export const EQUIPMENT_LABEL = Object.fromEntries(EQUIPMENT.map(e => [e.value, e.label]))
export const SQUAT_STYLE_LABEL = Object.fromEntries(SQUAT_STYLES.map(x => [x.value, x.label]))
export const DEADLIFT_STYLE_LABEL = Object.fromEntries(DEADLIFT_STYLES.map(x => [x.value, x.label]))
