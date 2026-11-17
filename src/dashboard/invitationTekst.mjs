// Ordre 1598: invitationsteksten coachen kopierer og sender til en ny atlet. Ren funktion, ingen mail sendes fra appen.
import { normalizeAthleteLoginEmail } from '../athleteOnboarding.js'

export const INGEN_MAIL_LINJE = 'Tilføj en mail til atleten for at få en invitation at kopiere.'
export const KOPIERING_FEJLET = 'Kunne ikke kopiere. Marker teksten og kopiér den selv.'

export function invitationTekst({ email, appAdresse } = {}) {
  const mail = normalizeAthleteLoginEmail(email)
  if (!mail) return null
  const adresse = String(appAdresse || '').trim().replace(/\/+$/, '')
  const link = !adresse ? '' : /^https?:\/\//.test(adresse) ? adresse : `https://${adresse}`
  return [
    'Velkommen til Entropi Coaching.',
    link ? `Åbn appen her: ${link}` : 'Åbn Entropi-appen.',
    `Opret dig med netop denne mail: ${mail}`,
    'Så bliver din profil koblet automatisk, og din første uge kommer i appen.',
  ].join('\n')
}

// Svarer altid med en besked, så en fejlet kopiering aldrig er stille.
export async function kopierInvitation(tekst, clipboard) {
  try {
    if (!tekst || typeof clipboard?.writeText !== 'function') throw new Error('ingen clipboard')
    await clipboard.writeText(tekst)
    return { ok: true, besked: 'Invitation kopieret. Intet er sendt.' }
  } catch {
    return { ok: false, besked: KOPIERING_FEJLET }
  }
}
