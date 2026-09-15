import { Component, Suspense, lazy, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { loadChunkWithRetry } from './lazyChunkLoad'

// ORDRE 163, del 2 — "en sort skærm er en ufanget fejl, ikke en langsom app".
//
// Før denne fil: App.jsx havde ÉN global ErrorBoundary om hele appen, og
// Dashboard.jsx's tre interne lazy-faner (Indbakke/Analyse/Program) havde kun
// Suspense, ingen egen fejlgrænse — en render-fejl i ÉN fane rev hele
// dashboardet ned til appens fulde "Ups"-skærm i stedet for at ramme kun det
// kort/den fane der fejlede. lazyWithReload.js dækkede kun ét scenarie: en
// stale chunk-reference efter en deploy (fikset med ét helside-genload).
//
// LazyBoundary erstatter begge: en lokal fejlgrænse PR. lazy-indlæst del, med
// en rolig "prøv igen"-knap der kun genindlæser DEN del (retryKey re-kører
// factory() i et helt nyt lazy()-objekt — genbrug af det samme lazy()-objekt
// virker ikke, React cacher permanent et afvist import-løfte på selve
// objektet). Selve genforsøgs-/back-off-logikken bor i lazyChunkLoad.js (ren,
// enhedstestet — se lazyChunkLoad.test.js).
async function loadWithRetry(factory, label) {
  const flag = `reloaded_chunk_${label}`
  const mod = await loadChunkWithRetry(factory, {
    hasReloadedOnce: () => !!sessionStorage.getItem(flag),
    markReloaded: () => sessionStorage.setItem(flag, '1'),
    reload: () => window.location.reload(),
  })
  // Lykkedes hentningen (evt. efter genforsøg): ryd flaget, så en SENERE,
  // ny deploy igen kan udløse ét frisk genindlæsningsforsøg i denne fane.
  sessionStorage.removeItem(flag)
  return mod
}

function logLazyError(label, error, info) {
  try {
    supabase.auth.getUser().then(({ data }) => {
      supabase.from('frontend_errors').insert({
        message: `[${label}] ${String(error?.message || error).slice(0, 960)}`,
        stack: String(error?.stack || '').slice(0, 4000),
        component_stack: String(info?.componentStack || '').slice(0, 4000),
        url: window.location.href,
        user_agent: navigator.userAgent,
        user_id: data?.user?.id ?? null,
      }).then(() => {})
    }).catch(() => {})
  } catch { /* logging må aldrig selv vælte appen */ }
}

class LocalCatch extends Component {
  static getDerivedStateFromError(error) { return { error } }
  constructor(props) { super(props); this.state = { error: null } }
  componentDidCatch(error, info) { logLazyError(this.props.label, error, info) }
  render() {
    if (this.state.error) return this.props.onError(this.state.error)
    return this.props.children
  }
}

function calmScreen(label, onRetry) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '0.85rem', padding: '2.5rem 1.5rem', textAlign: 'center',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <div style={{ fontSize: '0.68rem', letterSpacing: '0.06em', color: '#b8b4a8' }}>
        Noget gik galt{label ? ` — ${label}` : ''}.
      </div>
      <button
        onClick={onRetry}
        style={{
          background: 'transparent', border: '1px solid rgba(200,146,58,0.45)', color: '#c8923a',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em',
          textTransform: 'uppercase', padding: '0.5rem 1.1rem', cursor: 'pointer', borderRadius: 2,
        }}
      >Prøv igen</button>
    </div>
  )
}

// factory: () => import('./NogenKomponent')  (peger på default export)
// componentProps: props videregivet til den indlæste komponent
export default function LazyBoundary({ factory, label, loading, componentProps = {} }) {
  const [retryKey, setRetryKey] = useState(0)
  // Nyt lazy()-objekt pr. forsøg ELLER når selve factory'en/label'en skifter.
  // `retryKey` læses ikke i selve callbacken — den står bevidst i deps som et
  // manuelt "tving nyt objekt"-signal til "Prøv igen" (se loadWithRetry
  // ovenfor), derfor disable'et. `factory`/`label` skal derimod med i deps
  // for reel korrekthed: to <LazyBoundary>'er kan sidde på SAMME position i
  // træet på tværs af et betinget udtryk (App.jsx skifter mellem Dashboard
  // og Atletvisning på samme sted) — React genbruger da denne instans'
  // interne state i stedet for at montere en ny, og uden `factory` i deps
  // blev det gamle, memoiserede lazy()-objekt (den forrige visning) siddende
  // selvom `factory`/`label`-props allerede var skiftet (ordre 215: "Min
  // træning" satte previewMode/coachAthleteId korrekt, men skærmen viste
  // stadig Dashboard — aldrig Atletvisningen).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- retryKey er bevidst med selvom den ikke læses i callbacken, se kommentaren ovenfor
  const Comp = useMemo(() => lazy(() => loadWithRetry(factory, label)), [retryKey, factory, label])
  return (
    <LocalCatch key={retryKey} label={label} onError={() => calmScreen(label, () => setRetryKey((k) => k + 1))}>
      <Suspense fallback={loading}>
        {/* eslint-disable-next-line react-hooks/static-components -- bevidst: "Prøv igen" skal give et FRISK lazy()-objekt (React cacher et afvist import-løfte for evigt på selve objektet), ikke bare en remount af det samme */}
        <Comp {...componentProps} />
      </Suspense>
    </LocalCatch>
  )
}
