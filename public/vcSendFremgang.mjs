// ORDRE 2441v (Marc 25. nov., ugeplanens målstreg 3: videocoach pålidelig). 2437 målte ved ca. 400 kbit/s op,
// at sendingen lykkes efter ca. 5 minutter, men at skærmen hele tiden kun siger "Sender video (14,1 MB) ...";
// en atlet på mobilnet lukker siden, fordi den ser død ud. Her vises den målte fremgang fra appens
// upload-progress ("Sender video: 6,2 af 14,1 MB", højst hvert sekund). Er fremgangen under ca. 1 % i 20 s,
// eller kan den ikke måles (reserven i Supabase giver ingen tal), står der i stedet, at nettet er langsomt.
// Tider, genforsøg, "Prøv igen" og 10-minutters-teksten (2399v) rører modulet ikke.

export const VC_SEND_LANGSOMT_TEKST = 'Nettet er langsomt. Videoen sendes stadig, bliv på skærmen.'
export const VC_SEND_STILLE_MS = 20000
export const VC_SEND_VIS_MINDST_MS = 900
export const VC_SEND_FREMSKRIDT_ANDEL = 0.01

export function mbTekst(bytes) {
  const mb = Number.isFinite(bytes) && bytes > 0 ? bytes / (1024 * 1024) : 0
  return mb.toFixed(1).replace('.', ',')
}

export function sendFremgangTekst(loaded, total) {
  return `Sender video: ${mbTekst(loaded)} af ${mbTekst(total)} MB`
}

// vis(tekst) skriver statusteksten. onProgress({ loaded, total }) kaldes med målte tal fra appen.
// stop() standser uret; bagefter skrives intet (så "Ikke sendt" eller "Sendt" aldrig overskrives).
export function createSendFremgang({ total, vis, now = () => Date.now(),
  setInterval = globalThis.setInterval, clearInterval = globalThis.clearInterval,
  stilleMs = VC_SEND_STILLE_MS, visMindstMs = VC_SEND_VIS_MINDST_MS } = {}) {
  let loaded = 0, maaltAndel = 0, sidstVist = 0, sidsteFremskridt = now(), langsomt = false, slut = false
  const tjek = () => {
    if (slut || langsomt) return
    if (now() - sidsteFremskridt >= stilleMs) { langsomt = true; vis(VC_SEND_LANGSOMT_TEKST) }
  }
  const ur = setInterval(tjek, 1000)
  return {
    onProgress(fremgang) {
      if (slut) return
      const t = Number(fremgang?.total), l = Number(fremgang?.loaded)
      if (!(t > 0) || !(l >= 0)) return
      total = t
      loaded = Math.min(l, t)
      const andel = loaded / total
      if (andel - maaltAndel >= VC_SEND_FREMSKRIDT_ANDEL) {
        maaltAndel = andel
        sidsteFremskridt = now()
        if (langsomt) { langsomt = false; sidstVist = 0 }
      }
      if (langsomt) return
      if (now() - sidstVist >= visMindstMs || loaded === total) {
        sidstVist = now()
        vis(sendFremgangTekst(loaded, total))
      }
    },
    stop() { slut = true; clearInterval(ur) },
    status() { return { loaded, total, langsomt, slut } },
  }
}
