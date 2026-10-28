// Genvejen ændrer kun visning. Formularens data ejes fortsat af AthleteView.
export function openReadinessSurface({ setTab, setMereOpen, setReadinessOpen, readinessCardRef, requestFrame, matchMedia }) {
  setTab('hjem')
  setMereOpen(false)
  setReadinessOpen(true)
  requestFrame(() => requestFrame(() => {
    const card = readinessCardRef.current
    if (!card) return
    const reduceMotion = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    card.focus({ preventScroll: true })
    card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }))
}

// Navigering lukker kun genvejsfladen. Felter og udkast bevares.
export function readinessNavigation(setTab, setReadinessOpen) {
  return destination => {
    setReadinessOpen(false)
    setTab(destination)
  }
}
