import { nutritionContracts } from './contracts.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'

// Assembly seam only. No flag discovery, URL activation, client creation or routing.
// Returns cleanup for a React effect or an owned DOM mount lifecycle.
export function mountNutritionScreen(host, { entropi2 = false, athlete, date, client,
  storage, foods, clock, onReadError, onWriteError, onCoach, onNavigate,
  weightLogs, weightInput, onWeightInput, logWeight, savingWeight } = {}) {
  if (entropi2 !== true) return () => {}
  const contracts = nutritionContracts({ client, onReadError, onWriteError })
  const controller = createNutritionController({ enabled: true, athlete, date, contracts, storage, foods })
  return mountNutrition(host, controller, { onCoach, onNavigate, clock,
    weightLogs, weightInput, onWeightInput, logWeight, savingWeight })
}
