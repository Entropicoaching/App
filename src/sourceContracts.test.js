// Own conservative source audit. Original tests are inert text, never executed.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {install} from './mob7Synthetic.mjs'
install()
const {DEFAULT_MOBILITY_ADHERENCE}=await import('./mobilityAdherence.mjs')
const readers=[
  "athlete/athleteShortcuts.test.js",
  "athlete/contactReview.test.js",
  "athlete/frem5App.test.js",
  "athlete/fremgangFokusReview.test.js",
  "athlete/fremgangLinjer.test.js",
  "athlete/kandFix1.test.js",
  "athlete/mob4Counter.test.js",
  "athlete/mob4Integration.test.js",
  "athlete/mob5.test.js",
  "athlete/mob5Review.test.js",
  "athlete/mobilityBeforeSession.test.js",
  "athlete/mobilityHelped.test.js",
  "athlete/mobilityReview.test.js",
  "athlete/prog2Review.test.js",
  "athlete/prog5Counter.test.js",
  "athlete/reb2Review.test.js",
  "athlete/rebaseFrem5.test.js",
  "athlete/repRecordsReview.test.js",
  "athlete/staevnedagFocus.review.test.js",
  "athlete/uge4Counter.test.js",
  "athlete/vaerd5Kontrol.test.js",
  "athleteReadGuard.test.js",
  "athleteTrainingInputs.test.js",
  "athleteWriteGuard.test.js",
  "blokFremgang.test.js",
  "checklistApp.test.js",
  "coachRyd.test.js",
  "coachRyd2.test.js",
  "coachRyd2Review.test.js",
  "coachRydR2.test.js",
  "dashboard/coachInactiveRebase.test.js",
  "dashboard/coachNotesReview.test.js",
  "mob6Counter.test.js",
  "mobile375.test.js",
  "mobilityHomework.test.js",
  "nytWiring.test.js",
  "readinessDraft.test.js",
  "rebaseFlags.test.js",
  "rebaseScope.test.js",
  "videoOptag2Selection.test.js"
]
const cases=[
  {
    "reader": "athlete/contactReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "import \\{ contactLatestEnabled, enterContact, scrollContactEnd \\} from '\\.\\/athlete\\/contactLatest\\.mjs'",
    "flags": ""
  },
  {
    "reader": "athlete/contactReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "enterContact\\(\\{ enabled: contactLatest, fetchMessages: fetchAthleteMessages, markRead: markTrackRead, fetchVideos: fetchSharedVideoAnalyses, track: msgTrack \\}\\)",
    "flags": ""
  },
  {
    "reader": "athlete/contactReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "scrollContactEnd\\(contactLatest, messagesEndRef\\)",
    "flags": ""
  },
  {
    "reader": "athlete/contactReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "sharedVideoAnalyses, sharedVideoError, sharedVideoLoading, contactLatest,",
    "flags": ""
  },
  {
    "reader": "athlete/frem5App.test.js",
    "host": "App.jsx",
    "pattern": "blokStyrke = false",
    "flags": ""
  },
  {
    "reader": "athlete/frem5App.test.js",
    "host": "AthleteView.jsx",
    "pattern": "blokStyrke = false",
    "flags": ""
  },
  {
    "reader": "athlete/frem5App.test.js",
    "host": "App.jsx",
    "pattern": "blokStyrke: blokStyrke === true",
    "flags": ""
  },
  {
    "reader": "athlete/frem5App.test.js",
    "host": "AthleteView.jsx",
    "pattern": "blokStyrke: blokStyrke === true",
    "flags": ""
  },
  {
    "reader": "athlete/frem5App.test.js",
    "host": "AthleteView.jsx",
    "pattern": "\\{ blokStyrke: blokStyrke === true",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangFokusReview.test.js",
    "host": "App.jsx",
    "pattern": "function App\\(\\{[^\\r\\n]*fremgangFokus = false[^\\r\\n]*\\} = \\{\\}\\)",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangFokusReview.test.js",
    "host": "App.jsx",
    "pattern": "fremgangFokus: fremgangFokus === true",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangFokusReview.test.js",
    "host": "App.jsx",
    "pattern": "fremgangFokus = false",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangFokusReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "fremgangFokus = false",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangFokusReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "factory=\\{fremgangFokus === true \\? fremgangFokusFactory : enkelOn \\? enkelFremgangFactory : fremgangFactory\\}",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangFokusReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": ": \\{ blokStyrke: blokStyrke === true, blokFremgang: blokFremgang === true, personalRecords: personalRecords === true, fremgangLinjer: fremgangLinjer === true, enkelDel: enkelOn \\? route : null, fremgangLogs, fremgangLoading, allWeeks, exerciseLogs, currentWeek \\}\\}",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangLinjer.test.js",
    "host": "App.jsx",
    "pattern": "[\\u2013\\u2014]",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangLinjer.test.js",
    "host": "AthleteView.jsx",
    "pattern": "[\\u2013\\u2014]",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangLinjer.test.js",
    "host": "dashboard/ProfilHoved.jsx",
    "pattern": "[\\u2013\\u2014]",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangLinjer.test.js",
    "host": "AthleteView.jsx",
    "pattern": "fremgangLinjer: fremgangLinjer === true",
    "flags": ""
  },
  {
    "reader": "athlete/fremgangLinjer.test.js",
    "host": "AthleteView.jsx",
    "pattern": "enkelDel: enkelOn \\? route : null",
    "flags": ""
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "dashboard/ProfilHoved.jsx",
    "pattern": "(from\\s+')\\.\\.\\/",
    "flags": ""
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "enkelPrototype = false",
    "flags": ""
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "const enkelOn = enkelPrototype === true",
    "flags": ""
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "^const enkelHjemFactory = .+$",
    "flags": "m"
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "function LazyEnkelHjemTab\\(props\\) \\{[\\s\\S]*?\\n\\}",
    "flags": ""
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "const HjemVisning = .+$",
    "flags": "m"
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "import\\('\\.\\/athlete\\/EnkelHjemTab(?:\\.jsx)?'\\)",
    "flags": ""
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "factory=\\{fremgangFokus === true \\? fremgangFokusFactory : enkelOn \\? enkelFremgangFactory : fremgangFactory\\}",
    "flags": ""
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "\\/\\/ eslint-disable-next-line react-hooks\\/exhaustive-deps -- begge kaldes synkront[^\\n]*\\n\\s*useEffect\\(",
    "flags": ""
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "const openReadiness = .+$",
    "flags": "m"
  },
  {
    "reader": "athlete/kandFix1.test.js",
    "host": "AthleteView.jsx",
    "pattern": "const setTab = readinessNavigation\\(destination => navigate\\(kostDestination\\(destination, visKost\\)\\), setReadinessOpen\\)",
    "flags": ""
  },
  {
    "reader": "athlete/mob4Counter.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetHjalp = false",
    "flags": ""
  },
  {
    "reader": "athlete/mob4Counter.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetHjalp = false",
    "flags": ""
  },
  {
    "reader": "athlete/mob4Counter.test.js",
    "host": "dashboard/ProfilHoved.jsx",
    "pattern": "mobilitetHjalp = false",
    "flags": ""
  },
  {
    "reader": "athlete/mob4Counter.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetHjalp: mobilitetHjalp === true",
    "flags": ""
  },
  {
    "reader": "athlete/mob4Counter.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetHjalp: mobilitetHjalp === true",
    "flags": ""
  },
  {
    "reader": "athlete/mob4Counter.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetHjalp: mobilitetHjalp === true && !coachAthleteId, athleteId: athlete\\?\\.id, mobilityDate: today\\(\\)",
    "flags": ""
  },
  {
    "reader": "athlete/mob5Review.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetCoach = false",
    "flags": ""
  },
  {
    "reader": "athlete/mob5Review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetCoach = false",
    "flags": ""
  },
  {
    "reader": "athlete/mob5Review.test.js",
    "host": "dashboard/ProfilHoved.jsx",
    "pattern": "mobilitetCoach = false",
    "flags": ""
  },
  {
    "reader": "athlete/mob5Review.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetCoach: mobilitetCoach === true",
    "flags": ""
  },
  {
    "reader": "athlete/mob5Review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetCoach: mobilitetCoach === true",
    "flags": ""
  },
  {
    "reader": "athlete/mobilityBeforeSession.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetFoerPas = false",
    "flags": ""
  },
  {
    "reader": "athlete/mobilityBeforeSession.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetFoerPas = false",
    "flags": ""
  },
  {
    "reader": "athlete/mobilityBeforeSession.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetFoerPas: mobilitetFoerPas === true,",
    "flags": ""
  },
  {
    "reader": "athlete/mobilityBeforeSession.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetFoerPas=\\{mobilitetFoerPas === true\\}",
    "flags": ""
  },
  {
    "reader": "athlete/mobilityReview.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetFokus = false",
    "flags": ""
  },
  {
    "reader": "athlete/mobilityReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetFokus = false",
    "flags": ""
  },
  {
    "reader": "athlete/mobilityReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "renderMobilityShortcut\\(createElement, \\{ enabled: mobilitetFokus === true \\|\\| mobilitetCoach === true, tab, enkelOn, route, setMobilityMode, setTab, coachSummary: createElement\\(CoachMobilitySummary, \\{ enabled: mobilitetCoach, athleteId: athlete\\?\\.id, notes: athlete\\?\\.notes \\}\\) \\}\\)",
    "flags": ""
  },
  {
    "reader": "athlete/mobilityReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetFokus: mobilitetFokus === true, currentWeek, mobilityIntake",
    "flags": ""
  },
  {
    "reader": "athlete/prog2Review.test.js",
    "host": "App.jsx",
    "pattern": "programNaesteUge = false",
    "flags": ""
  },
  {
    "reader": "athlete/prog2Review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "programNaesteUge = false",
    "flags": ""
  },
  {
    "reader": "athlete/prog2Review.test.js",
    "host": "App.jsx",
    "pattern": "programNaesteUge: programNaesteUge === true",
    "flags": ""
  },
  {
    "reader": "athlete/prog2Review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "weekStartDate, programIntensityHelp, programUgeFoerst, programNaesteUge, programBlokOversigt, fetchProgramBlockLogs, vaerdF6",
    "flags": ""
  },
  {
    "reader": "athlete/prog5Counter.test.js",
    "host": "App.jsx",
    "pattern": "programIntensityHelp = false",
    "flags": ""
  },
  {
    "reader": "athlete/prog5Counter.test.js",
    "host": "AthleteView.jsx",
    "pattern": "programIntensityHelp = false",
    "flags": ""
  },
  {
    "reader": "athlete/prog5Counter.test.js",
    "host": "AthleteView.jsx",
    "pattern": "weekStartDate, programIntensityHelp, programUgeFoerst",
    "flags": ""
  },
  {
    "reader": "athlete/reb2Review.test.js",
    "host": "App.jsx",
    "pattern": "<LazyBoundary\\s+factory=\\{athleteViewFactory\\}[\\s\\S]*?componentProps=\\{\\{([\\s\\S]*?)\\}\\}\\s*\\/>",
    "flags": ""
  },
  {
    "reader": "athlete/reb2Review.test.js",
    "host": "App.jsx",
    "pattern": "(?:^|,)\\s*programNaesteUge\\s*:\\s*programNaesteUge\\s*===\\s*true\\s*(?=,|$)",
    "flags": ""
  },
  {
    "reader": "athlete/reb2Review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "<LazyBoundary\\s+factory=\\{programFactory\\}[\\s\\S]*?componentProps=\\{\\{([\\s\\S]*?)\\}\\}\\s*\\/>",
    "flags": ""
  },
  {
    "reader": "athlete/reb2Review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "(?:^|,)\\s*programNaesteUge\\s*(?=,|$)",
    "flags": ""
  },
  {
    "reader": "athlete/rebaseFrem5.test.js",
    "host": "AthleteView.jsx",
    "pattern": "\\{ blokStyrke: blokStyrke === true[^{}]*currentWeek \\}",
    "flags": ""
  },
  {
    "reader": "athlete/rebaseFrem5.test.js",
    "host": "App.jsx",
    "pattern": "programNaesteUge = false",
    "flags": ""
  },
  {
    "reader": "athlete/rebaseFrem5.test.js",
    "host": "AthleteView.jsx",
    "pattern": "programNaesteUge = false",
    "flags": ""
  },
  {
    "reader": "athlete/rebaseFrem5.test.js",
    "host": "AthleteView.jsx",
    "pattern": "videoSetSelection = VIDEO_SET_SELECTION_ENABLED",
    "flags": ""
  },
  {
    "reader": "athlete/rebaseFrem5.test.js",
    "host": "App.jsx",
    "pattern": "programIntensityHelp = false",
    "flags": ""
  },
  {
    "reader": "athlete/rebaseFrem5.test.js",
    "host": "AthleteView.jsx",
    "pattern": "programIntensityHelp = false",
    "flags": ""
  },
  {
    "reader": "athlete/repRecordsReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "repRecords\\s*=\\s*false",
    "flags": ""
  },
  {
    "reader": "athlete/repRecordsReview.test.js",
    "host": "AthleteView.jsx",
    "pattern": "repRecords:\\s*repRecords\\s*===\\s*true",
    "flags": ""
  },
  {
    "reader": "athlete/staevnedagFocus.review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "staevnedagFokus = false",
    "flags": ""
  },
  {
    "reader": "athlete/staevnedagFocus.review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "factory=\\{staevnedagFactory\\}[\\s\\S]*?componentProps=\\{\\{[\\s\\S]*?showFlash, staevnedagFokus,",
    "flags": ""
  },
  {
    "reader": "athlete/staevnedagFocus.review.test.js",
    "host": "AthleteView.jsx",
    "pattern": "staevnedagFokus",
    "flags": ""
  },
  {
    "reader": "athlete/uge4Counter.test.js",
    "host": "App.jsx",
    "pattern": "ugeLogget = false",
    "flags": ""
  },
  {
    "reader": "athlete/uge4Counter.test.js",
    "host": "AthleteView.jsx",
    "pattern": "ugeLogget = false",
    "flags": ""
  },
  {
    "reader": "athlete/uge4Counter.test.js",
    "host": "App.jsx",
    "pattern": "componentProps=\\{\\{ \\.\\.\\.rel3\\.athlete, ugeLogget: ugeLogget === true",
    "flags": ""
  },
  {
    "reader": "athlete/uge4Counter.test.js",
    "host": "AthleteView.jsx",
    "pattern": "ugeLogget=\\{ugeLogget === true\\}",
    "flags": ""
  },
  {
    "reader": "athlete/vaerd5Kontrol.test.js",
    "host": "AthleteView.jsx",
    "pattern": "vaerdF6 = false",
    "flags": ""
  },
  {
    "reader": "athleteWriteGuard.test.js",
    "host": "AthleteView.jsx",
    "pattern": "skipExercise",
    "flags": "u"
  },
  {
    "reader": "blokFremgang.test.js",
    "host": "App.jsx",
    "pattern": "blokFremgang = false",
    "flags": ""
  },
  {
    "reader": "blokFremgang.test.js",
    "host": "AthleteView.jsx",
    "pattern": "blokFremgang = false",
    "flags": ""
  },
  {
    "reader": "blokFremgang.test.js",
    "host": "App.jsx",
    "pattern": "blokFremgang: blokFremgang === true",
    "flags": ""
  },
  {
    "reader": "blokFremgang.test.js",
    "host": "AthleteView.jsx",
    "pattern": "blokFremgang: blokFremgang === true",
    "flags": ""
  },
  {
    "reader": "blokFremgang.test.js",
    "host": "AthleteView.jsx",
    "pattern": "componentProps=\\{[\\s\\S]*?blokFremgang: blokFremgang === true,[\\s\\S]*?enkelDel:",
    "flags": ""
  },
  {
    "reader": "dashboard/coachInactiveRebase.test.js",
    "host": "App.jsx",
    "pattern": "ugeLogget[^\\n]*programNaesteUge",
    "flags": ""
  },
  {
    "reader": "dashboard/coachInactiveRebase.test.js",
    "host": "AthleteView.jsx",
    "pattern": "coachInactive|CoachActions|laesninger",
    "flags": ""
  },
  {
    "reader": "mobilityHomework.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetHjemme = false",
    "flags": ""
  },
  {
    "reader": "mobilityHomework.test.js",
    "host": "AthleteView.jsx",
    "pattern": "mobilitetHjemme = false",
    "flags": ""
  },
  {
    "reader": "mobilityHomework.test.js",
    "host": "dashboard/ProfilHoved.jsx",
    "pattern": "mobilitetHjemme = false",
    "flags": ""
  },
  {
    "reader": "mobilityHomework.test.js",
    "host": "App.jsx",
    "pattern": "mobilitetHjemme: mobilitetHjemme === true",
    "flags": ""
  },
  {
    "reader": "mobilityHomework.test.js",
    "host": "AthleteView.jsx",
    "pattern": "tab === 'hjem' && \\(!enkelOn \\|\\| \\['traening', 'alle'\\].includes\\(route\\)\\) && <MobilityHomeworkHome key=\\{athlete\\?\\.id\\} enabled=\\{mobilitetHjemme\\} athleteId=\\{athlete\\?\\.id\\}",
    "flags": ""
  },
  {
    "reader": "nytWiring.test.js",
    "host": "AthleteView.jsx",
    "pattern": "profileId=\\{session\\?\\.user\\?\\.id\\}",
    "flags": ""
  },
  {
    "reader": "nytWiring.test.js",
    "host": "AthleteView.jsx",
    "pattern": "search=\\{typeof window === 'undefined' \\? '' : window.location.search\\}",
    "flags": ""
  },
  {
    "reader": "nytWiring.test.js",
    "host": "AthleteView.jsx",
    "pattern": "onNavigate=\\{nytAthleteNavigation\\(\\{ setTab, setMsgTrack, setMobilityMode \\}\\)\\}",
    "flags": ""
  },
  {
    "reader": "nytWiring.test.js",
    "host": "AthleteView.jsx",
    "pattern": "role === 'athlete' && !coachAthleteId && !onExitPreview",
    "flags": ""
  }
]
for(const reader of readers) test('source contracts: '+reader,()=>{
 assert.equal(DEFAULT_MOBILITY_ADHERENCE,false)
 // Read every identified source reader in its repository location as text.
 assert.ok(readFileSync(new URL(reader,import.meta.url),'utf8').length)
 for(const c of cases.filter(c=>c.reader===reader)) {
  const source=readFileSync(new URL(c.host,import.meta.url),'utf8')
  for(const eol of ['\n','\r\n']) assert.match(source.replace(/\r?\n/g,eol),new RegExp(c.pattern,c.flags),c.host+' '+c.pattern)
 }
})
