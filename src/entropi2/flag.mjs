// Entropi 2: ét fælles flag for de samlede skærme. Tændt for alle (Marc 3. nov. 2026 kl. 17:44: "vil åbne det for alle på en gang").
// Kun en eksplicit true eller standardværdien tænder; ingen URL, storage eller env.
export const DEFAULT_ENTROPI2 = true
export function entropi2Enabled(value = DEFAULT_ENTROPI2) {
  return value === true || DEFAULT_ENTROPI2 === true
}
