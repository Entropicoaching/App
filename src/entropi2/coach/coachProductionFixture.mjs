export const day = '2026-11-03'
export const athleteId = 'synthetic-a'
export function productionFixture() {
  return { enabled: true, today: day, session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day, athleteIds: [athleteId] },
    athletes: [{ id: athleteId, name: 'Syntetisk atlet' }],
    calendarWeeks: { [athleteId]: [{ start_date: '2026-11-02', session_count: 3, exercise_count: 1 }] },
    coachActionsStatus: { calendar: 'ready', activity: { state: 'ready', day, ids: [athleteId], rows: [
      { id: 'synthetic-set', athlete_id: athleteId, logged_at: `${day}T10:00:00Z`,
        weight: 50, reps_completed: 5, rpe_actual: 7, exercises: { sessions: { id: 'synthetic-session' } } },
    ] } },
    coachMorningData: { messages: { state: 'ready', day, ids: [athleteId], rows: [] },
      videos: { state: 'ready', day, ids: [athleteId], rows: [] } },
    coachNutrition: { coachId: 'synthetic-coach', day, athleteIds: [athleteId], state: 'ready', complete: true,
      from: '2026-10-28', through: day,
      rows: ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', day]
        .map((date, i) => ({ id: `synthetic-meal-${i}`, athlete_id: athleteId, date,
          meal: 'Syntetisk måltid', kcal: 1800, protein: 50 })),
      targets: [{ athlete_id: athleteId, protein_target: 100 }] },
    openProfile() {}, openCoachPriorityItem() {}, setView() {}, setSelectedAthlete() {} }
}
