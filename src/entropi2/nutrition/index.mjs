import { nutritionContracts } from './contracts.mjs'
import { createNutritionController } from './controller.mjs'
import { mountNutrition } from './view.mjs'

// Assembly seam only. No flag discovery, URL activation, client creation or routing.
// Returns cleanup for a React effect or an owned DOM mount lifecycle.
export function mountNutritionScreen(host, { entropi2 = false, athlete, date, client,
  storage, foods, clock, onReadError, onWriteError, onCoach, onNavigate, currentDay, onDayChanged,
  weightLogs, weightStatus, weightInput, onWeightInput, logWeight, savingWeight, retryWeight } = {}) {
  if (entropi2 !== true) return () => {}
  const contracts = nutritionContracts({ client, onReadError, onWriteError })
  const controller = createNutritionController({ enabled: true, athlete, date, contracts, storage, foods, currentDay, onDayChanged })
  return mountNutrition(host, controller, { onCoach, onNavigate, clock,
    weightLogs, weightStatus, weightInput, onWeightInput, logWeight, savingWeight, retryWeight })
}
