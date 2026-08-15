// Regression: atletens stangbane-flow må ikke miste en sat start eller blive
// stående i "Vælg skive", når brugeren spoler for at orientere sig.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const dashboard = readFileSync(join(here, '..', '..', 'src', 'Dashboard.jsx'), 'utf8');
const athleteView = readFileSync(join(here, '..', '..', 'src', 'AthleteView.jsx'), 'utf8');
const fail = (condition, message) => { if (condition) throw new Error(message); };

const visibleBoundsSource = html.match(/function vcVisibleCanvasBounds\([\s\S]*?\n\}/)?.[0];
fail(!visibleBoundsSource, 'Rep-/fartboksen skal have en beregnet synlig canvas-safe-area.');
const visibleBounds = Function(`${visibleBoundsSource}; return vcVisibleCanvasBounds;`)();
const croppedPortraitBounds = visibleBounds(
  {left:315,top:-64,right:951,bottom:1066,width:636,height:1130},
  {left:315,top:58,right:951,bottom:550}, 1080, 1920);
fail(croppedPortraitBounds.top < 200,
  'Rep-/fartboksen skal flyttes under topbjælken, når et portrætcanvas er beskåret.');
fail(croppedPortraitBounds.left < 0 || croppedPortraitBounds.right > 1080,
  'Rep-/fartboksens safe-area skal blive inden for canvasbredden.');

fail(!/videocoach\.html\?coach=1&bridge=v3&v=\$\{VIDEOCOACH_BUILD_ID\}/.test(dashboard),
  'Coachens profilvisning skal bruge den fulde coach-bro og den aktuelle cacheversion.');
fail(!/videocoach\.html\?mode=athlete&bridge=athlete-v1&v=\$\{VIDEOCOACH_BUILD_ID\}/.test(athleteView),
  'Atletens profilvisning skal bruge den begrænsede atletbro og den aktuelle cacheversion.');

fail(!/id="dropOpenVideoBtn" type="button">Åbn video<\/button>/.test(html),
  'Den almindelige lokale desktopvisning skal have en synlig Åbn video-knap.');
fail(!/getElementById\('dropOpenVideoBtn'\)\.onclick[\s\S]{0,180}getElementById\('fileInput'\)\.click\(\)/.test(html),
  'Desktopvisningens Åbn video-knap skal åbne filvælgeren.');
fail(!/if \(ATHLETE && manualTrackingBounds\.start == null\)/.test(html),
  'Stangbane må ikke åbne skiveguiden, før atleten har sat start.');
fail(!/if \(ATHLETE && !vcV3Lift\(document\.getElementById\('liftSel'\)\.value\)\)/.test(html),
  'Stangbane må ikke åbne skiveguiden, før atleten har valgt løft.');
fail(!/const hasStart = manualTrackingBounds\.start != null[\s\S]{0,260}Start sat ✓/.test(html),
  'En sat start skal overleve, når ready-flowet vises igen.');
fail(!/const syncAthleteStartGate = \(\) => \{[\s\S]{0,360}Sæt start først[\s\S]{0,180}state === 'target' \|\| needsStart/.test(html) ||
     !/athleteStartGuideText\.textContent = `Start \$\{athleteTime\(trimStart\)\} · tryk Stangbane`;[\s\S]{0,100}syncAthleteStartGate\(\)/.test(html),
  'Stangbane skal tydeligt være låst, indtil Sæt start her er gennemført.');
fail(!/if \(disarmed && ATHLETE && setAthleteState\) setAthleteState\('ready'\);/.test(html),
  'Spoling skal returnere en afvæbnet skiveguide til atletens ready-trin.');
fail(!/if \(wizard\) \{[\s\S]{0,220}disarmed = true;/.test(html),
  'Spoling skal afvæbne både den almindelige og session-baserede skiveguide.');
fail(!/id="athleteOpenVideoBtn" class="athCta" type="button">Åbn video<\/button>/.test(html),
  'Atleten skal se en rigtig Åbn video-knap.');
fail(!/const chooseAthleteVideo = \(\) => document\.getElementById\('fileInput'\)\.click\(\);[\s\S]{0,260}athleteOpenVideoBtn/.test(html),
  'Atletens Åbn video-knap skal åbne filvælgeren direkte.');
fail(!/sourceLift\.dispatchEvent\(new Event\('change', \{ bubbles:true \}\)\)/.test(html),
  'Atletens synlige løftvalg skal køre hovedvælgerens variations-flow.');
fail(!/path\.analysis\.lift !== vcV3Lift\(e\.target\.value\)[\s\S]{0,360}setAthleteState\('ready'/.test(html),
  'Et skift af løftetype efter analyse skal kræve en ny, fagligt korrekt analyse.');
fail(!/\['Gns\. fart',[\s\S]{0,100}\['Løftevej',[\s\S]{0,100}\['Tempo'/.test(html),
  'Atletens tre validerede resultatmålinger skal have forståelige danske labels.');
fail(!/function applySessionView[\s\S]{0,100}vcSetWorkspace\('review'\)/.test(html),
  'En færdig analyse skal åbne Bane-resultatet automatisk.');
fail(!/VC_ATHLETE_PHASE_LABELS[\s\S]{0,180}concentric:'Op'[\s\S]{0,80}return:'Ned igen'/.test(html),
  'Atletens faseforklaring skal være kort og dansk.');
fail(!/body\.athlete \.vcOverlayControls \{ display:none !important; \}/.test(html),
  'Atleten skal se resultatet uden tekniske overlay-indstillinger.');
fail(!/plateConfirm = \{ x: p\.x, y: p\.y, r: 22\.5 \/ scale \}/.test(html) ||
     !/allBtn\.textContent = 'Start analyse'/.test(html),
  'Desktop skal vise den justerbare kalibreringsring før analysen starter.');
fail(/function drawTrackedPlateRing/.test(html),
  'Kalibreringsringen må ikke følge skiven efter opsætningen.');
fail(!/cmPerPx = 45 \/ \(2 \* c\.r\);[\s\S]{0,180}if \(DESKTOP\) sessionRun = true;/.test(html),
  'En manuelt justeret ring skal opdatere måleskalaen og åbne desktop-resultatet.');
fail(!/const measurable = rep && Number\.isFinite\(rep\.mcv\)/.test(html),
  'Beregnelige metrics må ikke skjules alene på grund af en konservativ kvalitetstærskel.');
fail(!/\.vcMetricCards\[hidden\] \{ display:none !important; \}/.test(html),
  'Metrics-knappen skal faktisk kunne skjule målekortene.');
fail(!/const currentVelocity = path\.vel\[i\];[\s\S]{0,180}Number\.isFinite\(currentVelocity\)/.test(html) ||
     !/const finiteSpeeds = path\.vel\.filter\(Number\.isFinite\)/.test(html),
  'Velocity-søjlen må aldrig forgiftes af NaN i ugyldige frames.');
fail(!/body\.athlete #vcBackStep, body\.athlete #vcContinueStep \{ display:none !important; \}/.test(html),
  'Atletflowet må ikke vise en ekstra top-handling ved siden af den guidede hovedknap.');
fail(!/body\.athlete:not\(\[data-athlete-state="done"\]\):not\(\[data-athlete-state="sent"\]\) footer[\s\S]{0,100}repeat\(2/.test(html) ||
     !/body\.athlete\.athlete-profile\[data-athlete-state="done"\] #penBtn[\s\S]{0,150}display:none !important/.test(html),
  'Atletens handlingsbar skal være to valg under klargøring og højst fire efter analysen.');
fail(!/body\.athlete #athleteSubmitCard[\s\S]{0,260}border-radius:24px/.test(html) ||
     !/athleteSubmitHead\.className = 'athleteSubmitHead'/.test(html) ||
     !/athleteSubmitFields\.className = 'athleteSubmitFields'/.test(html),
  'Atletens sendeark skal bruge den rolige, responsive produktskal frem for inline-styling.');
fail(!/body\.athlete #vcSystemBar \{ grid-template-columns:minmax\(0,1fr\) auto/.test(html) ||
     !/body\.athlete \.vcSystemBrand, body\.athlete #vcSystemState \{ display:none !important; \}/.test(html),
  'Atletens mobiltop skal prioritere arbejdstrinnene frem for dubleret brand og status.');
fail(!/\.iconbtn\[hidden\] \{ display:none !important; \}/.test(html),
  'Fordyb må ikke være synlig før en analyse blot fordi knappen har ikonlayout.');
fail(!/id="vcHudCollapse"[\s\S]{0,180}Minimér analyseresultat/.test(html) ||
     !/vcHudCollapse\.onclick = \(\) => \{[\s\S]{0,280}vcHudCollapsed/.test(html),
  'Desktop-resultatet skal kunne minimeres uden at ændre analysen.');
fail(!/body\.desktop #barPathHUD \{[\s\S]{0,180}minmax\(128px,\.8fr\)/.test(html) ||
     !/body\.desktop \.vcRepSelector \{[\s\S]{0,140}flex-wrap:wrap;[\s\S]{0,80}overflow:visible/.test(html),
  'Desktop skal vise mindst fire reps uden overlap og wrappe længere sæt.');
fail(!/body\.desktop\.vcDeskTrayOpen #barPathHUD \{ display:none !important; \}/.test(html) ||
     !/const setDesktopTrayOpen = open => \{[\s\S]{0,180}vcDeskTrayOpen/.test(html),
  'Fordyb skal åbne frit uden at blive dækket af resultatmetrics.');
fail(!/body\.coachweb\[data-coach-state="setup"\] footer,[\s\S]{0,220}#vcContinueStep \{ display:none !important; \}/.test(html),
  'Coachens klargøring skal være ren uden analyseværktøjer før en video er åbnet.');
fail(!/let syncCoachSetupBridge = null/.test(html) ||
     !/if \(syncCoachSetupBridge\) syncCoachSetupBridge\(\)/.test(html) ||
     !/setupAthlete\.replaceChildren\([\s\S]{0,280}option\.dataset\.athleteId/.test(html),
  'Coachens startkort skal bruge den aktuelle, profilkoblede atletliste fra appbroen.');
fail(!/if \(COACHWEB\) document\.body\.dataset\.coachState = 'video';/.test(html) ||
  !/if \(COACHWEB\) document\.body\.dataset\.coachState = 'setup';/.test(html),
  'Coachens analyseværktøjer skal følge videoens faktiske load/error-tilstand.');
fail(!/const desktopLift = document\.getElementById\('liftSel'\);[\s\S]{0,180}vcLiftSlot/.test(html),
  'Desktop skal kunne vælge løftetype før analysen og før Fordyb åbnes.');
fail(!/const usableRep = resultPath\?\.analysis\?\.reps\?\.some/.test(html) ||
     !/Ingen tydelig rep blev fundet/.test(html),
  'Tracking uden en målelig rep må ikke blive meldt som en færdig analyse.');
fail(!/vcSetWorkspace\(view === 'export' \? 'review' : 'video'\)/.test(html),
  'Tilbage fra Eksport skal gå til Bane i stedet for helt tilbage til Video.');
fail(!/const FORCE_DESKTOP = TRACKER_BENCHMARK && MODE_PARAMS\.get\('desktop'\) === '1'/.test(html),
  'Desktop-ét-kliksflowet skal kunne browsertestes uden at ændre normal drift.');

console.log('GRØN: ATHLETE-START-FLOW-01.');
