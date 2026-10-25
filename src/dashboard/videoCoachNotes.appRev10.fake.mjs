let database
export function setDatabase(value) { database = value }
export const supabase = {
  from(...args) {
    if (!database) throw new Error('Den syntetiske database er ikke sat')
    return database.from(...args)
  },
  storage: { from() { throw new Error('Klip er uden for prøven') } },
}
