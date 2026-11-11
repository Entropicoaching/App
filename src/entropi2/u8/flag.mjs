// U8 (ordre 78): push. Ét flag pr. del, samme mønster som U3 til U7: en eksplicit værdi vinder,
// ellers gælder standardværdien. Rollback er den ene linje pr. del.
// push: kortet på forsiden og service workerens visning. send: edge-funktionen u8-push.
// Uden nøgle eller tabel viser appen det samme som U7, og funktionen sender intet.
export const DEFAULT_U8_PUSH = true
export const DEFAULT_U8_SEND = true

const defaults = () => ({ push: DEFAULT_U8_PUSH, send: DEFAULT_U8_SEND })
export function u8Enabled(part, value) {
  if (value === undefined) return defaults()[part] === true
  return value === true
}
