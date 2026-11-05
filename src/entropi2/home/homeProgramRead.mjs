// Observe the existing program reader; no second query, storage or write path.
// fetchProgram reports success before supplying non-empty weeks, and returns
// early for an empty result. Clear stale content only after confirmed success.
export function homeProgramReadSetters({ onReadError, setProgramError, setProgramLoading,
  setAllWeeks, setCurrentWeek, setOfflineSnapshotAt }) {
  let emptySuccess = null
  return {
    // The existing reader obtains its error callback before awaiting the query.
    // Observe that boundary for initial reads and reads from other tabs too.
    onReadError(label, ...args) {
      if (label === 'Dit program') setProgramLoading(true)
      return onReadError(label, ...args)
    },
    setProgramError(error) {
      setProgramError(error)
      emptySuccess = null
      if (error) setProgramLoading(false)
      else {
        setOfflineSnapshotAt(null)
        const success = {}
        emptySuccess = success
        // Non-empty results supply setAllWeeks synchronously after this callback.
        // Defer empty cleanup so other program views retain the reader's normal
        // state sequence while it awaits completion logs for a populated week.
        queueMicrotask(() => {
          if (emptySuccess !== success) return
          emptySuccess = null
          setAllWeeks([])
          setCurrentWeek(null)
          setProgramLoading(false)
        })
      }
    },
    setAllWeeks(weeks) {
      emptySuccess = null
      setAllWeeks(weeks)
      // The reader may still be awaiting the active week's completion logs.
      setProgramLoading(true)
    },
    setCurrentWeek(week) {
      setCurrentWeek(week)
      setProgramLoading(false)
    },
    setOfflineSnapshotAt(at) {
      setOfflineSnapshotAt(at)
      // An offline snapshot can contain the athlete without a program week.
      if (at != null) setProgramLoading(false)
    },
  }
}

export async function retryHomeProgram(read, { setProgramError, setProgramLoading }) {
  setProgramLoading(true)
  try { await read() } catch { setProgramError(true) }
  finally { setProgramLoading(false) }
}
