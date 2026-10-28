export const state = { responses: [], calls: [] }
export const withRetry = fn => fn()
export const supabase = {
  from(table) {
    const call = { table, steps: [] }
    state.calls.push(call)
    const query = new Proxy({}, { get(_, key) {
      if (key === 'then') return (resolve, reject) => {
        const response = state.responses.shift()
        if (response instanceof Error) return Promise.reject(response).then(resolve, reject)
        if (!response) return Promise.reject(Error('No synthetic response')).then(resolve, reject)
        return Promise.resolve(response).then(resolve, reject)
      }
      return (...args) => { call.steps.push([key, ...args]); return query }
    } })
    return query
  },
}
