// Regression: atletens stangbane-flow må ikke miste en sat start eller blive
// stående i "Vælg skive", når brugeren spoler for at orientere sig.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');
const fail = (condition, message) => { if (condition) throw new Error(message); };

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
fail(!/const FORCE_DESKTOP = TRACKER_BENCHMARK && MODE_PARAMS\.get\('desktop'\) === '1'/.test(html),
  'Desktop-ét-kliksflowet skal kunne browsertestes uden at ændre normal drift.');

console.log('GRØN: ATHLETE-START-FLOW-01.');
