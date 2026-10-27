import React from 'react'
import { createRoot } from 'react-dom/client'
import { athleteFlags, coachFlags, queryFlags, screens, isolatePreview, renderScreenList } from '../src/fridayPreview.mjs'
import { USER, COACH } from '../src/fridayPreviewSeed.mjs'
import '../src/index.css'
import '../src/App.css'

async function start() {
  if (import.meta.env.MODE !== 'e2e' || location.protocol !== 'http:' ||
      !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw new Error('Kun lokal preview')
  // An older worker on the same origin could intercept requests before CSP.
  if (navigator.serviceWorker?.controller) throw new Error('Brug en frisk lokal oprindelse uden service worker')
  isolatePreview(window)
  const url = new URL(location.href)
  for (const [key,value] of Object.entries(queryFlags)) url.searchParams.set(key,value)
  const screen = screens.find(item => item.id === url.searchParams.get('screen')) || screens[0]
  history.replaceState(null, '', url)
  const [{ default: AthleteView }, { default: Dashboard }] = await Promise.all([
    import('../src/AthleteView.jsx'), import('../src/Dashboard.jsx'),
  ])
  const session = { user: { id: screen.role === 'coach' ? COACH : USER, email: `${screen.role}@example.test` } }
  const h = React.createElement
  createRoot(document.getElementById('root')).render(h(React.Fragment, null,
    h('aside', { 'data-friday-preview': '', style: { padding: 12, border: '2px solid #c8923a' } },
      h('strong', null, 'Syntetisk preview. Ingen rigtige data. Skrivehandlinger er slået fra.'),
      h('p', null, `${screen.title}: ${screen.steps}`),
      h('details', null, h('summary', null, 'Skærmliste'), renderScreenList(h, url.href))),
    screen.role === 'coach'
      ? h(Dashboard, { ...coachFlags, session, onPreviewAthlete: () => { location.href = '?screen=atlet-hjem' } })
      : h(AthleteView, { ...athleteFlags, session, role: 'athlete' })))
}
start().catch(error => { document.getElementById('root').textContent = `Preview kunne ikke åbnes: ${error.message}` })
