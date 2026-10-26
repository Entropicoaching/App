import { existsSync } from 'node:fs'
export const athleteViewUrl = existsSync(new URL('./AthleteView.jsx', import.meta.url))
  ? new URL('./AthleteView.jsx', import.meta.url)
  : new URL('../AthleteView.jsx', import.meta.url)
