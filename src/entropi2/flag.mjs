// Entropi 2: ét fælles flag for de samlede skærme. Slukket som standard.
// Kun en eksplicit true eller standardværdien tænder; ingen URL, storage eller env.
export const DEFAULT_ENTROPI2 = false
export function entropi2Enabled(value = DEFAULT_ENTROPI2) {
  return value === true || DEFAULT_ENTROPI2 === true
}
