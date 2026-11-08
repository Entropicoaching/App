// Bundled module only. Called by the enabled, explicitly opened coach editor.
// No application cache: each editor owns its pending result and lifetime.
export async function loadCoachFoods() {
  const { COACH_FOODS } = await import('./frida55.mjs')
  return COACH_FOODS
}
