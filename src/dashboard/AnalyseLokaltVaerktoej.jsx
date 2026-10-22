import { useReducer } from 'react'
import { initialLocalVideoState, localVideoTransition } from './vaLocalState.mjs'
import { sessionDocument, modelDocument } from './vaLocalDocuments'

// Deliberately has no props: data and callbacks from the athlete review stay outside.
export default function AnalyseLokaltVaerktoej() {
  const [state, dispatch] = useReducer(localVideoTransition, initialLocalVideoState)
  const button = { minHeight: 44, padding: '0.6rem 1rem', cursor: 'pointer' }
  return (
    <section aria-label="Lokalt videoanalyseværktøj" style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #647582', borderRadius: 8 }}>
      <h2>Lokalt analyseværktøj</h2>
      <p>Måling, håndmarkering, fund, sammenligning og model af løftet med syntetiske data.</p>
      <button type="button" style={button} aria-expanded={state.open} aria-controls="va-int1-local"
        onClick={() => dispatch(state.open ? 'close' : 'open')}>
        {state.open ? 'Luk lokalt værktøj' : 'Åbn lokalt værktøj'}
      </button>
      {state.open && (
        <div id="va-int1-local">
          <p>Kun syntetisk prøvegrundlag. Intet gemmes. Skift af værktøj, lukning eller atlet rydder arbejdet i værktøjet. Kopiér sessionens eksporttekst før du forlader den.</p>
          <p>Målesession og løftmodel har hver sit inputformat. Der overføres ingen data mellem dem. Fund og cues afventer Marc; fysisk måleaccept og teknikaccept er false.</p>
          <nav aria-label="Lokale analyseværktøjer" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" style={button} aria-pressed={state.tool === 'session'} onClick={() => dispatch('session')}>Måling, markering, fund og sammenligning</button>
            <button type="button" style={button} aria-pressed={state.tool === 'model'} onClick={() => dispatch('model')}>Model af løftet</button>
          </nav>
          <iframe key={state.tool} title={state.tool === 'session' ? 'Syntetisk målesession' : 'Syntetisk løftmodel'}
            sandbox="allow-scripts" referrerPolicy="no-referrer"
            srcDoc={state.tool === 'session' ? sessionDocument : modelDocument}
            style={{ display: 'block', width: '100%', height: '75vh', minHeight: 420, border: '1px solid #647582', marginTop: 12 }} />
        </div>
      )}
    </section>
  )
}
