// ORDRE 177 (13. sep), commit 1: oversættelsen mellem PROGRAM og KROP —
// hvilke muskelgrupper belaster en given øvelse, og hvor meget. Første
// version, "ærlig frem for smart" (ordrens egne ord): et sæt er ikke en
// måleenhed for belastning, og en øvelse rammer typisk flere grupper i
// meget forskellig grad. Denne fil siger IKKE hvor meget en muskel
// arbejder (det kræver en biomekanisk model, se entropi-loeftmodel) — den
// siger kun HVILKE grupper en øvelse tæller med i, og med hvilken vægt på
// en tre-trins skala:
//   PRIMÆR (1,0)     — øvelsens hovedbevægelse driver denne gruppe.
//   MEDVIRKENDE (0,5) — gruppen bærer en væsentlig del af arbejdet, men er
//                        ikke hvad øvelsen er "for".
//   (ikke nævnt)      — gruppen tælles slet ikke med for denne øvelse.
// Ingen andre tal end disse to bruges — en tredje værdi ville lade som om
// modellen ved mere end den gør (se docs/VOLUMEN.md for hvad tallene IKKE
// betyder).
//
// STÅ PÅ SKULDRE (ordrens egen instruks):
// - Gruppenavnene og deres danske labels for kneeExtensors, hipExtensors,
//   backExtensors og plantarFlexors er taget ORDRET fra
//   entropi-loeftmodel/src/muscles.js's MUSCLE_GROUPS_DA (squat/dødløft),
//   og pectoralisMajor/anteriorDeltoid/triceps ligeså fra samme fils
//   BENCH_MUSCLE_GROUPS_DA (bænkpres) — se også
//   entropi-loeftmodel/docs/muskler-litteratur.md. Formålet er at de to
//   modeller kan tale samme sprog senere, IKKE et kodeafhængighedsforhold
//   (de er to separate repos, ingen import herfra til loeftmodellen).
// - lats og biceps er NYE grupper her (loeftmodellen dækker kun squat/
//   dødløft/bænkpres, ikke trækøvelser) — se begrundelse ved hver øvelse
//   nedenfor. Ingen af de to har en biomekanisk kilde som loeftmodellens
//   momentarme; de er anatomisk almindelig viden (hvilken muskel driver
//   hvilken ledbevægelse), mærket 'skoen'.
// - Mønsteret "primær/sekundær pr. øvelse, aldrig et enkelt tal for hele
//   øvelsen" er det samme mønster åbne, permissivt licenserede trænings-
//   logs bruger (fx free-exercise-db's primaryMuscles/secondaryMuscles).
//   Ingen af deres data eller tal er kopieret hertil — kun mønstret.
//
// GRÆNSE: øvelser der ikke er kortlagt her (stavemåde inkl. — se
// normaliser() nedenfor) falder tilbage på "ukendt" i beregn.js og tælles
// ALDRIG med i nogen gruppes sum. Det er en bevidst grænse, ikke en fejl —
// se docs/VOLUMEN.md.

import { foldNavn, grundnavn } from '../exerciseNames.js'

export const PRIMÆR = 1
export const MEDVIRKENDE = 0.5

// Samme nøgler og danske labels som entropi-loeftmodel/src/muscles.js —
// se filens egen toptekst. lats og biceps er tilføjet her (ikke i
// loeftmodellen).
export const MUSKELGRUPPER = Object.freeze({
  kneeExtensors: 'Knæ-strækkere',
  hipExtensors: 'Hoftestrækkere',
  backExtensors: 'Rygstrækkere',
  plantarFlexors: 'Læggen',
  pectoralisMajor: 'Brystmuskel',
  anteriorDeltoid: 'Forreste skulder',
  triceps: 'Triceps',
  lats: 'Ryggens brede muskler',
  biceps: 'Biceps',
})

const KILDE_LOEFTMODEL = 'entropi-loeftmodel/src/muscles.js + docs/muskler-litteratur.md'

// Hver post: exerciseNavn (som coachen typisk ville skrive den) -> liste af
// { gruppe, andel, kilde }. Nøglerne slås op via normaliser() nedenfor, så
// stavevarianter og suffikser ("Squat - topsæt") rammer samme post.
const RAA_KORT = {
  // --- Squat-familien ------------------------------------------------------
  'Squat': {
    grupper: [
      { gruppe: 'kneeExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (a)` },
      { gruppe: 'hipExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (b)` },
      { gruppe: 'backExtensors', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (c) — isometrisk holdearbejde, ikke øvelsens drivende ekstensor` },
      { gruppe: 'plantarFlexors', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (d) — stabiliserende, ikke drivende` },
    ],
  },
  'Frontbøjning': {
    grupper: [
      { gruppe: 'kneeExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (a) — samme knæledsbevægelse som squat` },
      { gruppe: 'hipExtensors', andel: MEDVIRKENDE, kilde: 'skoen: mere oprejst torso end back squat flytter mere af arbejdet mod knæet, hoften bidrager stadig' },
      { gruppe: 'backExtensors', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (c) — isometrisk holdearbejde` },
    ],
  },
  'Goblet squat': {
    grupper: [
      { gruppe: 'kneeExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (a)` },
      { gruppe: 'hipExtensors', andel: MEDVIRKENDE, kilde: 'skoen: samme bevægelsesmønster som frontbøjning, let belastning' },
    ],
  },
  'Bulgarsk split squat': {
    grupper: [
      { gruppe: 'kneeExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (a) — samme knæledsbevægelse, ét ben ad gangen` },
      { gruppe: 'hipExtensors', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (b) — mindre hoftefleksion end squat` },
    ],
  },
  'Udfald': {
    grupper: [
      { gruppe: 'kneeExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (a)` },
      { gruppe: 'hipExtensors', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (b)` },
    ],
  },
  'Benpres': {
    grupper: [
      { gruppe: 'kneeExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (a)` },
      { gruppe: 'hipExtensors', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (b) — sædet bærer torso, mindre rygbidrag end fritstående squat, derfor ingen backExtensors-linje her` },
    ],
  },
  'Benstrækker': {
    grupper: [
      { gruppe: 'kneeExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (a) — isoleret knæekstension, ingen anden gruppe medvirker nævneværdigt` },
    ],
  },

  // --- Dødløft-familien ------------------------------------------------------
  'Dødløft': {
    grupper: [
      { gruppe: 'hipExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (e)-(g)` },
      { gruppe: 'backExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (e)-(g)` },
      { gruppe: 'kneeExtensors', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (e)-(g) — mindre knæmoment end squat` },
    ],
  },
  'Rumænsk dødløft': {
    grupper: [
      { gruppe: 'hipExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (b) — hoftefleksion/-ekstension er hele bevægelsen` },
      { gruppe: 'backExtensors', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (c) — isometrisk holdearbejde` },
    ],
  },
  'Sumo dødløft': {
    grupper: [
      { gruppe: 'hipExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (e)-(g)` },
      { gruppe: 'backExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (e)-(g)` },
      { gruppe: 'kneeExtensors', andel: MEDVIRKENDE, kilde: 'skoen: bredere stance og mere oprejst torso end konventionel dødløft flytter mere mod knæet' },
    ],
  },
  'Hip thrust': {
    grupper: [
      { gruppe: 'hipExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (b) — ren hofteekstension` },
    ],
  },
  'Good morning': {
    grupper: [
      { gruppe: 'hipExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (b)` },
      { gruppe: 'backExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (c)` },
    ],
  },
  'Rygstrækninger': {
    grupper: [
      { gruppe: 'backExtensors', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (c)` },
    ],
  },

  // --- Bænkpres-familien ------------------------------------------------------
  'Bænkpres': {
    grupper: [
      { gruppe: 'pectoralisMajor', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (k)` },
      { gruppe: 'anteriorDeltoid', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (k)` },
      { gruppe: 'triceps', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (j)` },
    ],
  },
  'Skråbænk': {
    grupper: [
      { gruppe: 'pectoralisMajor', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (k) — samme muskel, øvre del mere involveret ved skrå vinkel` },
      { gruppe: 'anteriorDeltoid', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (k) — mere skulderbidrag end fladt bænkpres` },
      { gruppe: 'triceps', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (j)` },
    ],
  },
  'Dyk': {
    grupper: [
      { gruppe: 'pectoralisMajor', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (k)` },
      { gruppe: 'triceps', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (j) — kortere vej end bænkpres, mere albuedrevet` },
    ],
  },
  'Close grip bænkpres': {
    grupper: [
      { gruppe: 'triceps', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (j) — smalt greb flytter hovedarbejdet mod albuen` },
      { gruppe: 'pectoralisMajor', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (k)` },
    ],
  },
  'Skulderpres': {
    grupper: [
      { gruppe: 'anteriorDeltoid', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (k)` },
      { gruppe: 'triceps', andel: MEDVIRKENDE, kilde: `${KILDE_LOEFTMODEL}, afsnit (j)` },
    ],
  },

  // --- Trækøvelser: lats + biceps er NYE grupper (ikke i loeftmodellen) ----
  'Roning': {
    grupper: [
      { gruppe: 'lats', andel: PRIMÆR, kilde: 'skoen: albuetræk mod torso er lats\' primære bevægelse, ingen biomekanisk kilde slået op i denne første version' },
      { gruppe: 'biceps', andel: MEDVIRKENDE, kilde: 'skoen: albuefleksion medvirker til at trække vægten hjem, ingen kilde slået op' },
    ],
  },
  'Nedtræk': {
    grupper: [
      { gruppe: 'lats', andel: PRIMÆR, kilde: 'skoen: samme bevægelse som pull-up, blot med kabel/vægtstak' },
      { gruppe: 'biceps', andel: MEDVIRKENDE, kilde: 'skoen: albuefleksion medvirker' },
    ],
  },
  'Pull-up': {
    grupper: [
      { gruppe: 'lats', andel: PRIMÆR, kilde: 'skoen: kropsvægtstræk, samme bevægelse som nedtræk' },
      { gruppe: 'biceps', andel: MEDVIRKENDE, kilde: 'skoen: albuefleksion medvirker' },
    ],
  },
  'Chins': {
    grupper: [
      { gruppe: 'lats', andel: PRIMÆR, kilde: 'skoen: underhåndsgreb flytter mere mod biceps end pull-up, men lats driver stadig trækket' },
      { gruppe: 'biceps', andel: PRIMÆR, kilde: 'skoen: underhåndsgrebets albuefleksion er væsentligt tungere end i pull-up/nedtræk' },
    ],
  },

  // --- Isoleret triceps og biceps -------------------------------------------
  'Triceps pushdown': {
    grupper: [
      { gruppe: 'triceps', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (j) — ren albueekstension` },
    ],
  },
  'Fransk pres': {
    grupper: [
      { gruppe: 'triceps', andel: PRIMÆR, kilde: `${KILDE_LOEFTMODEL}, afsnit (j) — ren albueekstension` },
    ],
  },
  'Biceps curl': {
    grupper: [
      { gruppe: 'biceps', andel: PRIMÆR, kilde: 'skoen: ren albuefleksion, ingen biomekanisk kilde slået op i denne første version' },
    ],
  },
  'Hammer curl': {
    grupper: [
      { gruppe: 'biceps', andel: PRIMÆR, kilde: 'skoen: ren albuefleksion, neutralt greb' },
    ],
  },
}

/** Fold+afkort samme vej som exerciseNames.js, så "Bænkpres - topsæt" og
 * "Baenkpres" rammer samme post som "Bænkpres". */
function normaliser(navn) {
  return foldNavn(grundnavn(navn))
}

const KORTLÆGNING = new Map()
for (const [navn, data] of Object.entries(RAA_KORT)) {
  KORTLÆGNING.set(normaliser(navn), data.grupper)
}

/**
 * Slå en øvelse op. Returnerer { kendt: false, grupper: [] } for alt
 * modellen ikke kender — ALDRIG et gæt. Kaldsteder (beregn.js) skal
 * behandle kendt:false som "ukendt", aldrig som "ingen belastning".
 *
 * @param {string} exerciseNavn
 * @returns {{ kendt: boolean, grupper: Array<{ gruppe: string, andel: number, kilde: string }> }}
 */
export function slaaOevelseOp(exerciseNavn) {
  const grupper = KORTLÆGNING.get(normaliser(exerciseNavn))
  if (!grupper) return { kendt: false, grupper: [] }
  return { kendt: true, grupper }
}

/** Alle øvelsesnavne modellen kender, til tests og evt. en admin-liste. */
export function kendteOevelser() {
  return Object.keys(RAA_KORT)
}
