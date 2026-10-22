import { useState } from 'react'
import Fund from './fundEngine.mjs'
import { emptyReview, activate, editReview, saveReview, loadReview } from './fundStorage.mjs'
import example from './fundSynthetic.json'
import { downloadReview } from './fundDownload.mjs'

export default function FundReview() {
  const [state, setState] = useState(emptyReview)
  const [input, setInput] = useState('')
  const [review, setReview] = useState('')
  const [output, setOutput] = useState('')
  const storage = () => window.localStorage
  const change = next => { setOutput(''); setState(next) }
  function run() {
    try { change(activate(Fund, JSON.parse(input))) }
    catch { change({ ...emptyReview(), message: 'AFVIST: ugyldigt syntetisk grundlag.' }) }
  }
  function restore() {
    const next = loadReview(Fund, storage, state)
    change(next)
    if (next.batch) setInput(JSON.stringify(next.batch, null, 2))
  }
  function importReview() {
    try {
      const clean = Fund.decode(review)
      change(activate(Fund, clean.batch, clean.answers))
      setInput(JSON.stringify(clean.batch, null, 2))
    } catch { setState({ ...state, message: 'AFVIST: ugyldige svar. Aktuelt arbejde er bevaret.' }) }
  }
  function exportReview() {
    let text
    try {
      if (!state.batch) throw new Error()
      text = Fund.encode(state.batch, state.answers)
      setOutput(text)
    } catch {
      setState({ ...state, message: 'Eksport afvist: vælg enig/uenig/kommentar; kommentar alene kræver tekst, højst 2000 tegn.' })
      return
    }
    const message = downloadReview(text, document, URL, Blob, setTimeout)
    setState({ ...state, message })
  }

  const clips = state.batch ? Fund.batch(state.batch) : []
  return <section aria-label="Lokal fundvurdering">
    <h3>Vurder syntetiske fund</h3>
    <p>Op til fem syntetiske klip. Tærskler afventer Marc. Svar dokumenterer ikke Marcs identitet, teknikaccept eller accept af fem rigtige klip. Ingen programændring.</p>
    <p>Lokal gemning er fælles for dette værktøj i browseren, uafhængigt af valgt atlet. Der gemmes én syntetisk session ad gangen. Gemning overskriver den tidligere session; indlæsning erstatter arbejdet i visningen.</p>
    <button type="button" onClick={() => { change(emptyReview()); setInput(JSON.stringify(example, null, 2)) }}>Vælg fem syntetiske klip</button>
    <label>Måleinput JSON<textarea rows={6} style={{ display: 'block', width: '100%' }} value={input} onChange={e => { setInput(e.target.value); change(emptyReview()) }} /></label>
    <button type="button" onClick={run}>Vis fund</button>
    <button type="button" onClick={restore}>Indlæs lokale svar</button>
    <details><summary>Indlæs eksporterede svar</summary>
      <label>Svar-JSON<textarea value={review} onChange={e => setReview(e.target.value)} /></label>
      <button type="button" onClick={importReview}>Indlæs svar-JSON</button>
    </details>
    <p role="status" aria-live="polite">{state.message}</p>
    <p>{state.batch ? state.dirty ? 'Aktuelt arbejde er ikke bekræftet gemt lokalt.' : 'Aktuelt arbejde er bekræftet gemt eller indlæst lokalt.' : 'Intet aktivt grundlag.'}</p>
    {clips.map(c => <section key={c.clip_id}>
      <h4>{c.clip_id} · {c.lift}</h4>
      <p>{c.findings.length} nominelle fund. {c.complete ? 'Alle mål tilgængelige.' : 'Ufuldstændigt målegrundlag.'} Ingen fund er ikke teknikaccept.</p>
      {c.assessments.map(a => {
        const answer = state.answers.find(v => v.clip_id === c.clip_id && v.finding_id === a.id)
        const edit = (decision, comment) => change(editReview(state, c.clip_id, a.id, decision, comment))
        return <article key={a.id}>
          <h5>{a.id} · {a.nominal_exceeds ? 'Fund' : 'Intet nominelt fund'}</h5>
          <p>{a.reason} Formel: {a.formula}. Tærskel: strengt større end {a.threshold} {a.unit}.</p>
          <p>{a.value === null ? 'Utilgængeligt: ' + a.unavailable_reason : 'Målt: ' + a.value + ' ' + a.unit} · Fejlgrænse: {a.abs_error_bound === null ? 'ukendt' : a.abs_error_bound + ' ' + a.unit} · Robust overskridelse: {a.robust_exceeds === null ? 'uafklaret' : a.robust_exceeds ? 'ja' : 'nej'}</p>
          <p>{a.source_note} Status: {a.status}.</p>
          {a.nominal_exceeds === true && <>
            <label>Vurdering {c.clip_id} / {a.id}<select value={answer?.decision || ''} onChange={e => edit(e.target.value, answer?.comment || '')}>
              <option value="">Ikke besvaret</option><option value="enig">Enig</option><option value="uenig">Uenig</option><option value="kommentar">Kommentar alene</option>
            </select></label>
            <label>Kommentar {c.clip_id} / {a.id} (højst 2000 tegn)<textarea maxLength={2000} value={answer?.comment || ''} onChange={e => edit(answer?.decision || '', e.target.value)} /></label>
          </>}
        </article>
      })}
    </section>)}
    <button type="button" disabled={!state.batch} onClick={() => setState(saveReview(Fund, storage, state))}>Gem lokalt (overskriv)</button>
    <button type="button" disabled={!state.batch} onClick={exportReview}>Eksportér svar som JSON-fil</button>
    <label>Eksporteret JSON<textarea rows={8} style={{ display: 'block', width: '100%' }} readOnly value={output} /></label>
  </section>
}
