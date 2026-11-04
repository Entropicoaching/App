// Entropi 2: ét fælles flag for de samlede skærme. Tændt for alle (Marc 3. nov. 2026 kl. 17:44: "vil åbne det for alle på en gang").
// Uden argument gælder standardværdien; en eksplicit værdi vinder altid, så entropi2={false}
// stadig vælger de gamle skærme (K-R4-ENTROPI-SAMLET fund 2). Ingen URL, storage eller env.
export const DEFAULT_ENTROPI2 = true
export function entropi2Enabled(value) {
  if (value === undefined) return DEFAULT_ENTROPI2 === true
  return value === true
}
