// Kører databasens egen kostplan_v1_valid_meals lokalt i PGlite, før noget skrives.
// Funktionen læses ordret fra den migration, der er live siden 8. nov.; den skrives ikke om.
// Ingen nøgler, intet net, ingen rigtige data.
import { FILES, read } from '../generalproeve/proeveDb.mjs'

export function validMealsFunctionSql() {
  const live = read(FILES.liveKostplan)
  const start = live.indexOf('create function public.kostplan_v1_valid_meals(meals jsonb)')
  const end = live.indexOf('\n$$;', start)
  if (start < 0 || end < 0) throw new Error('kostplan_v1_valid_meals findes ikke i den live migration')
  return live.slice(start, end + 4)
}

// days: [{ date, meals }]. Returnerer datoerne, hvor databasen ville afvise meals.
export async function sqlAfviserMeals(days, { PGlite } = {}) {
  if (!PGlite) ({ PGlite } = await import('@electric-sql/pglite'))
  const db = new PGlite()
  try {
    await db.exec(validMealsFunctionSql())
    const afvist = []
    for (const day of days) {
      const { rows } = await db.query('select public.kostplan_v1_valid_meals($1::jsonb) ok', [JSON.stringify(day.meals)])
      if (rows[0].ok !== true) afvist.push(day.date)
    }
    return afvist
  } finally {
    await db.close()
  }
}
