// Ren logik bag login-skærmen. Komponenten skal kun tegne; alt hvad der kan
// afgøres uden React ligger her, så det kan prøves uden at rendere noget.

export const MIN_PASSWORD_LENGTH = 8

// En side lagt på iOS-hjemmeskærmen kører i sin egen cookie- og storage-jar,
// adskilt fra Safari. Et login-link i en mail åbner ALTID i standardbrowseren,
// så sessionen lander i Safari og aldrig i appen. Derfor kan mail-login
// principielt ikke lukke løkken herinde — adgangskoden er den eneste vej, fordi
// den ligger på serveren og ikke i en storage-jar.
export function isStandaloneApp(win = typeof window === 'undefined' ? null : window) {
  if (!win) return false
  if (win.navigator && win.navigator.standalone === true) return true
  try {
    return Boolean(win.matchMedia && win.matchMedia('(display-mode: standalone)').matches)
  } catch {
    return false
  }
}

// I appen er mail-login en blindgyde, så adgangskoden skal møde brugeren først.
// I browseren er mail-login stadig det nemmeste, og der er ingen grund til at
// kræve en adgangskode af nogen der ikke har brug for en.
export function initialLoginMode(win) {
  return isStandaloneApp(win) ? 'password' : 'magic-link'
}

// Supabase udveksler recovery-tokenet i URL'en til en rigtig session, før den
// fortæller os at det var en nulstilling. Uden dette tjek ville medlemmet blive
// lukket direkte ind i appen og aldrig få sat den adgangskode han bad om.
export function isRecoveryEvent(event) {
  return event === 'PASSWORD_RECOVERY'
}

export function validateNewPassword(password, confirmation) {
  const value = String(password ?? '')
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Adgangskoden skal være mindst ${MIN_PASSWORD_LENGTH} tegn.` }
  }
  if (value.trim().length === 0) {
    return { ok: false, reason: 'Adgangskoden må ikke kun være mellemrum.' }
  }
  if (value !== String(confirmation ?? '')) {
    return { ok: false, reason: 'De to adgangskoder er ikke ens.' }
  }
  return { ok: true, reason: '' }
}

// Nulstilling må aldrig røbe om en mail findes i piloten. Supabase svarer selv
// ens i begge tilfælde; beskeden her skal gøre det samme, ellers bliver
// login-skærmen en måde at afprøve mailadresser på.
export const RESET_SENT_MESSAGE = 'Findes der en konto på den mail, er der nu sendt et link til at vælge en ny adgangskode. Åbn det i browseren — kom derefter tilbage hertil og log ind med adgangskoden.'
