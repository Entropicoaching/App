import { createNutritionController } from '../../nutrition/controller.mjs'
import { mountNutrition } from '../../nutrition/view.mjs'

// Reuse the whole existing kcal tracker, including its log, update/remove,
// food portions, favorites and failure UI. Persistence functions are injected.
// Existing nutrition CSS belongs to the assembly, as for mountNutrition itself.
export function mountExistingTracker(host, options = {}) {
  if (options.enabled !== true) return () => {}
  const { athlete, date, contracts, storage, foods, currentDay, onDayChanged, ...view } = options
  const controller = createNutritionController({ enabled: true, athlete, date,
    contracts, storage, foods, currentDay, onDayChanged })
  try { return mountNutrition(host, controller, view) }
  catch (error) { controller.dispose(); throw error }
}
