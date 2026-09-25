// F: Jaevn fremgang, RPE paa plan, alle pas gennemfoert. Intet at bemaerke.
import { buildAthlete } from './helpers.mjs'

export default buildAthlete({
  id: 'syn-f', name: 'Atlet F',
  about: 'Intet at bemaerke: fremgang, RPE paa plan, fuldt fremmoede',
  readiness: [
    { logged_date: '2026-09-16', energy: 4, motivation: 4, stress: 2, soreness_level: 2, sore_zones: null },
    { logged_date: '2026-09-23', energy: 4, motivation: 5, stress: 2, soreness_level: 2, sore_zones: null },
  ],
})
