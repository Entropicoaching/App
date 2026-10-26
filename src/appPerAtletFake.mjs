// Kun syntetiske data. Ingen klient eller forbindelse oprettes.
export const writes = []
export let reply
export function reset(data) { writes.length = 0; reply = { data, error: null } }
export const supabase = {
  from(table) {
    const q = {
      update(payload) { writes.push({ table, payload, filters: [] }); return q },
      eq(key, value) { writes.at(-1).filters.push([key, value]); return q },
      select() { return q }, single() { return q },
      then(resolve, reject) { return Promise.resolve(reply).then(resolve, reject) },
    }
    return q
  },
}
