// Kun syntetisk datalager. Ingen klient, net eller persistens.
export const state = { inserts: [], data: [], error: null }
export function reset(data = [], error = null) {
  state.inserts = []; state.data = data; state.error = error
}
export const supabase = {
  from(table) {
    const query = {
      select() { return this }, eq() { return this }, order() { return this },
      insert(payload) { state.inserts.push({ table, payload }); return this },
      then(resolve, reject) { return Promise.resolve({ data: state.data, error: state.error }).then(resolve, reject) },
    }
    return query
  },
}
