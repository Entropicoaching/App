// U8 del 3: hvem skal have hvad, uden ur, net eller database. handler.mjs giver data og tid.
// Påmindelsen bygger på appens egne regler: "I dag"-kortets rækkefølge (todayItems: vægt,
// dagsform, mad) og friendlyReminders' madregel (ingen mad i tre dage giver en blidere tekst).
import { friendlyReminders } from '../../../src/entropi2/paamindelser/reminderRules.mjs'
import { todayItems } from '../../../src/entropi2/home/today/todayModel.mjs'
import { isDayReceipt } from '../../../src/mealEvidence.mjs'
import { addCalendarDays } from '../../../src/calendarDate.js'

// Dansk dato og minut på dagen for et tidspunkt.
export function copenhagen(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric',
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]))
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) }
}

const minuteOf = time => {
  const m = /^(\d{2}):(\d{2})(?::00)?$/.exec(String(time ?? ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
// Funktionen kører hvert 5. minut. En påmindelse er forfalden fra sit tidspunkt og en time frem,
// så en forsinket eller sprunget kørsel ikke taber dagens påmindelse.
export function reminderDue(remindAt, minute) {
  const at = minuteOf(remindAt)
  return at != null && minute >= at && minute < at + 60
}

// Én bruger kan have flere telefoner, og én telefon kan have haft flere brugere.
// Kun den nyeste række pr. endpoint får beskeder.
export function newestPerEndpoint(rows) {
  const seen = new Set(), out = []
  for (const row of [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
    if (!row?.endpoint || seen.has(row.endpoint)) continue
    seen.add(row.endpoint)
    out.push(row)
  }
  return out
}

// Påmindelsens tekst for én atlet i dag, eller null hvis intet mangler.
export function reminderMessage({ today, minute, weightDone, readinessDone, mealDays }) {
  const meals = Array.isArray(mealDays) ? mealDays : []
  const items = todayItems({ weight: { done: weightDone === true }, readiness: { done: readinessDone === true },
    meal: { status: 'ready', today: meals.includes(today) ? 1 : 0 } })
  if (!items.missing.length) return null
  // Hele døgnet er vinduet; tidspunktet er atletens eget valg.
  const nutrition = friendlyReminders({ enabled: true, today, minuteOfDay: minute, window: { start: 0, end: 1439 },
    nutrition: { complete: true, observedFrom: addCalendarDays(today, -7), loggedDays: meals.filter(d => d <= today) } })
    .find(r => r.kind === 'nutrition')
  return { title: items.headline, body: nutrition && items.missing.includes('meal') ? nutrition.text : 'Det tager under et minut. Tryk for at åbne appen.',
    url: '/?u8=idag', tag: 'paamindelse' }
}

// Dage med mindst ét rigtigt måltid (dagskvitteringer tæller ikke, som på "I dag"-kortet).
export const mealDaysOf = rows => [...new Set((Array.isArray(rows) ? rows : [])
  .filter(row => typeof row?.date === 'string' && !isDayReceipt(row)).map(row => row.date))]

export function replyMessage(count) {
  return { title: 'Din coach har svaret', body: count > 1 ? `${count} nye beskeder. Tryk for at læse dem.` : 'Tryk for at læse beskeden.',
    url: '/?u8=beskeder', tag: 'coach-svar' }
}
