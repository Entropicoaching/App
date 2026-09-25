// G: Logger RPE 1 under plan paa alt de sidste 3 uger (det ligner "for let"),
// men tre af fire check-ins i samme periode siger oemhed 5/5 og energi 1-2/5.
import { buildAthlete, defaultSession } from './helpers.mjs'

export default buildAthlete({
  id: 'syn-g', name: 'Atlet G',
  about: 'Modstridende: RPE 1 under plan, men check-ins siger meget oem og lav energi',
  session: (w, p) => defaultSession(w, p, { shift: week => (week >= 5 ? -1 : 0) }),
  readiness: [
    { logged_date: '2026-09-08', energy: 2, motivation: 3, stress: 4, soreness_level: 5, sore_zones: ['Ben', 'Ryg'] },
    { logged_date: '2026-09-12', energy: 3, motivation: 3, stress: 3, soreness_level: 3, sore_zones: null },
    { logged_date: '2026-09-17', energy: 1, motivation: 2, stress: 4, soreness_level: 5, sore_zones: ['Ben'] },
    { logged_date: '2026-09-23', energy: 2, motivation: 2, stress: 4, soreness_level: 5, sore_zones: ['Ryg'] },
  ],
})
