import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('uncaughtException', (error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, name), 'utf8'));
const coach = load('coach-briefing-v1.json');
const monitor = load('automation-error-monitor-v1.json');

const option = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  assert.ok(process.argv[index + 1], `${name} requires a file path`);
  return process.argv[index + 1];
};

const node = (workflow, name) => {
  const match = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(match, `${workflow.name}: missing node "${name}"`);
  return match;
};

const targets = (workflow, name) =>
  (workflow.connections[name]?.main ?? [])
    .flat()
    .map((connection) => connection.node);

const assertDirectChain = (workflow, names) => {
  for (let index = 0; index < names.length - 1; index += 1) {
    const from = names[index];
    const to = names[index + 1];
    assert.deepEqual(targets(workflow, from), [to], `${workflow.name}: expected ${from} -> ${to}`);
  }
};

const assertWorkflowShape = (workflow) => {
  assert.equal(workflow.active, false, `${workflow.name}: repository workflow must stay inactive`);
  assert.equal(new Set(workflow.nodes.map(({ id }) => id)).size, workflow.nodes.length, `${workflow.name}: duplicate node id`);
  assert.equal(new Set(workflow.nodes.map(({ name }) => name)).size, workflow.nodes.length, `${workflow.name}: duplicate node name`);
  assert.ok(workflow.nodes.every((candidate) => !Object.hasOwn(candidate, 'credentials')), `${workflow.name}: credential binding metadata must not be committed`);

  const names = new Set(workflow.nodes.map(({ name }) => name));
  for (const [source, outputGroups] of Object.entries(workflow.connections)) {
    assert.ok(names.has(source), `${workflow.name}: connection source "${source}" is missing`);
    for (const connection of outputGroups.main.flat()) {
      assert.ok(names.has(connection.node), `${workflow.name}: connection target "${connection.node}" is missing`);
    }
  }
};

const assertLiveWorkflow = (source, live, credentialNodeNames) => {
  assert.equal(live.id, source.id, `${source.name}: live workflow id differs from source`);
  assert.equal(live.active, true, `${source.name}: live workflow is not active`);
  assert.ok(live.versionId, `${source.name}: live workflow has no version id`);
  assert.equal(live.activeVersionId, live.versionId, `${source.name}: draft and published versions differ`);

  const actualCredentialNodes = live.nodes
    .filter((candidate) => Object.hasOwn(candidate, 'credentials'))
    .map(({ name }) => name)
    .sort();
  assert.deepEqual(
    actualCredentialNodes,
    [...credentialNodeNames].sort(),
    `${source.name}: live credential bindings are missing or attached to unexpected nodes`,
  );

  const normalizeNode = ({ credentials: _credentials, webhookId: _webhookId, ...candidate }) => candidate;
  const sourceNodes = source.nodes.map(normalizeNode);
  const liveNodes = live.nodes.map(normalizeNode);
  if (JSON.stringify(liveNodes) !== JSON.stringify(sourceNodes)) {
    throw new Error(`${source.name}: live node definitions drifted from source`);
  }
  if (JSON.stringify(live.connections) !== JSON.stringify(source.connections)) {
    throw new Error(`${source.name}: live connections drifted from source`);
  }
};

const runCode = (code, { input, mode = 'test', config = {}, state = {} }) => {
  const execute = new Function('$input', '$execution', '$', '$getWorkflowStaticData', code);
  return execute(
    { first: () => input },
    { mode },
    () => ({ first: () => ({ json: config }) }),
    () => state,
  );
};

assertWorkflowShape(coach);
assertWorkflowShape(monitor);

assert.equal(coach.settings.errorWorkflow, monitor.id, 'Coach briefing must stay linked to the error monitor');
assert.equal(
  node(coach, 'Daily catch-up 12:00–21:00').parameters.rule.interval[0].expression,
  '0 0 12-21 * * *',
  'Coach briefing schedule must remain hourly from 12:00 through 21:00',
);

assertDirectChain(coach, [
  'Configuration',
  'Fetch coach briefing',
  'Validate briefing contract',
  'Keep unresolved backup items',
  'Build briefing',
  'Frame fallback email',
  'Skip if sent today',
  'Block test delivery',
  'Send coach briefing',
  'Record successful delivery',
]);
assert.deepEqual(targets(coach, 'Manual test'), ['Configuration']);
assert.deepEqual(targets(coach, 'Daily catch-up 12:00–21:00'), ['Configuration']);
assert.equal(node(coach, 'Send coach briefing').type, 'n8n-nodes-base.emailSend');

assertDirectChain(monitor, [
  'Error Trigger',
  'Build safe error alert',
  'Send error alert',
  'Record successful alert',
]);
assert.equal(node(monitor, 'Error Trigger').type, 'n8n-nodes-base.errorTrigger');
assert.equal(node(monitor, 'Send error alert').type, 'n8n-nodes-base.emailSend');
assert.doesNotMatch(
  node(monitor, 'Build safe error alert').parameters.jsCode,
  /(?:data|execution)\.error\b/,
  'Error monitor must not place raw error objects in its alert',
);

const validBriefing = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  coach_id: 'coach-test',
  unread_messages: [],
  video_drafts: [],
  training_signals: [],
};
const config = {
  coachId: 'coach-test',
  coachEmail: 'coach@example.invalid',
  appUrl: 'https://example.invalid/?coach=inbox',
};

const contractCode = node(coach, 'Validate briefing contract').parameters.jsCode;
assert.equal(runCode(contractCode, { input: { json: validBriefing }, config }).length, 1);
assert.throws(
  () => runCode(contractCode, { input: { json: { ...validBriefing, coach_id: 'wrong-coach' } }, config }),
  /coach identity mismatch/,
  'Contract gate must reject a mismatched coach identity',
);

const keepCode = node(coach, 'Keep unresolved backup items').parameters.jsCode;
const emptyProduction = runCode(keepCode, { input: { json: validBriefing }, mode: 'production' });
assert.deepEqual(emptyProduction, [], 'Empty production briefing must stay silent');

const emptyPreview = runCode(keepCode, { input: { json: validBriefing }, mode: 'test' });
assert.equal(emptyPreview.length, 1, 'Empty test execution must create a preview item');
assert.equal(emptyPreview[0].json.preview_only, true);
assert.equal(emptyPreview[0].json.unread_messages[0].athlete_id, 'preview-only');
assert.equal(emptyPreview[0].json.unread_messages[0].athlete_name, 'Eksempelatlet');

const builtPreview = runCode(node(coach, 'Build briefing').parameters.jsCode, {
  input: emptyPreview[0],
  mode: 'test',
  config,
});
assert.equal(builtPreview.length, 1, 'Synthetic preview must render an email');
assert.match(builtPreview[0].json.html, /Eksempelatlet/);

const now = Date.now();
const fallbackCandidates = {
  ...validBriefing,
  unread_messages: [
    {
      athlete_id: 'old-message',
      athlete_name: '<script>Atlet</script>',
      track: 'besked',
      unread_count: 2,
      latest_at: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
      message_content: 'PRIVATE_MESSAGE_BODY',
    },
    {
      athlete_id: 'recent-message',
      athlete_name: 'Ny besked',
      track: 'besked',
      unread_count: 1,
      latest_at: new Date(now - 60 * 60 * 1000).toISOString(),
    },
    {
      athlete_id: 'invalid-time',
      athlete_name: 'Ukendt tid',
      track: 'teknik',
      unread_count: 1,
      latest_at: 'not-a-timestamp',
    },
  ],
  video_drafts: [
    {
      id: 'old-video',
      athlete_id: 'old-video-athlete',
      athlete_name: 'Videoatlet',
      lift: 'Squat',
      created_at: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      storage_url: 'PRIVATE_VIDEO_URL',
    },
    {
      id: 'recent-video',
      athlete_id: 'recent-video-athlete',
      athlete_name: 'Ny video',
      lift: 'Dødløft',
      created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
  training_signals: [
    { athlete_id: 'alert-athlete', athlete_name: 'Alert', severity: 'alert', detector: 'readiness', detail: 'Kræver et kig' },
    { athlete_id: 'context-athlete', athlete_name: 'Kontekst', severity: 'context', detector: 'trend', detail: 'App-only' },
  ],
};
assert.equal(
  runCode(contractCode, { input: { json: fallbackCandidates }, config }).length,
  1,
  'Contract gate must accept the documented item metadata',
);
assert.throws(
  () => runCode(contractCode, {
    input: { json: { ...validBriefing, unread_messages: [null] } },
    config,
  }),
  /unread_messages\[0\] must be an object/,
  'Contract gate must reject non-object array items before downstream code runs',
);
assert.throws(
  () => runCode(contractCode, {
    input: {
      json: {
        ...validBriefing,
        unread_messages: [{
          athlete_id: 'athlete-test',
          athlete_name: 'Testatlet',
          track: 'besked',
          unread_count: 'not-a-count',
        }],
      },
    },
    config,
  }),
  /unread_count missing or invalid/,
  'Contract gate must reject an invalid unread count instead of producing NaN',
);
const filteredProduction = runCode(keepCode, {
  input: { json: fallbackCandidates },
  mode: 'production',
});
assert.deepEqual(
  filteredProduction[0].json.unread_messages.map(({ athlete_id }) => athlete_id),
  ['old-message', 'invalid-time'],
  'Only old or invalid-timestamp messages may enter the fallback email',
);
assert.deepEqual(
  filteredProduction[0].json.video_drafts.map(({ id }) => id),
  ['old-video'],
  'Only video drafts at least 24 hours old may enter the fallback email',
);
assert.deepEqual(
  filteredProduction[0].json.training_signals.map(({ athlete_id }) => athlete_id),
  ['alert-athlete'],
  'Only alert training signals may enter the fallback email',
);

const filteredEmail = runCode(node(coach, 'Build briefing').parameters.jsCode, {
  input: filteredProduction[0],
  mode: 'production',
  config,
})[0].json.html;
assert.match(filteredEmail, /&lt;script&gt;Atlet&lt;\/script&gt;/, 'Athlete metadata must be HTML-escaped');
assert.doesNotMatch(filteredEmail, /<script>Atlet<\/script>/, 'Unescaped athlete metadata must never reach HTML');
assert.doesNotMatch(filteredEmail, /PRIVATE_MESSAGE_BODY/, 'Message content must never reach the fallback email');
assert.doesNotMatch(filteredEmail, /PRIVATE_VIDEO_URL/, 'Video storage URLs must never reach the fallback email');

const framedPreview = runCode(node(coach, 'Frame fallback email').parameters.jsCode, {
  input: builtPreview[0],
  mode: 'test',
});
const previewAfterDailyGate = runCode(node(coach, 'Skip if sent today').parameters.jsCode, {
  input: framedPreview[0],
  mode: 'test',
  state: { lastDeliveredDate: framedPreview[0].json.briefingDate },
});
assert.equal(previewAfterDailyGate.length, 1, 'Manual preview must bypass daily production suppression');
assert.deepEqual(
  runCode(node(coach, 'Block test delivery').parameters.jsCode, {
    input: previewAfterDailyGate[0],
    mode: 'test',
  }),
  [],
  'Manual preview must stop before SMTP',
);

const productionItem = { json: { ...framedPreview[0].json, preview_only: false } };
assert.deepEqual(
  runCode(node(coach, 'Skip if sent today').parameters.jsCode, {
    input: productionItem,
    mode: 'production',
    state: { lastDeliveredDate: productionItem.json.briefingDate },
  }),
  [],
  'A second production delivery on the same day must be suppressed',
);
assert.equal(
  runCode(node(coach, 'Block test delivery').parameters.jsCode, {
    input: productionItem,
    mode: 'production',
  }).length,
  1,
  'Production items must be allowed to reach SMTP',
);

const monitorCode = node(monitor, 'Build safe error alert').parameters.jsCode;
const monitorInput = {
  json: {
    workflow: { id: 'workflow-test', name: 'Test workflow' },
    execution: {
      id: 'execution-test',
      lastNodeExecuted: 'Fetch data',
      mode: 'production',
      url: 'https://untrusted.invalid/execution',
      error: { message: 'PRIVATE_RAW_ERROR' },
    },
    athlete: { name: 'PRIVATE_ATHLETE_DATA' },
  },
};
const monitorState = {};
const safeAlert = runCode(monitorCode, { input: monitorInput, mode: 'production', state: monitorState });
assert.equal(safeAlert.length, 1);
const serializedAlert = JSON.stringify(safeAlert[0].json);
assert.doesNotMatch(serializedAlert, /PRIVATE_RAW_ERROR/, 'Raw errors must never reach automation alerts');
assert.doesNotMatch(serializedAlert, /PRIVATE_ATHLETE_DATA/, 'Athlete data must never reach automation alerts');
assert.match(safeAlert[0].json.html, /http:\/\/127\.0\.0\.1:5678\/home\/executions/, 'Untrusted execution links must fall back to loopback n8n');
assert.deepEqual(
  runCode(monitorCode, {
    input: monitorInput,
    mode: 'production',
    state: { lastNotifiedAtByWorkflow: { 'workflow-test': Date.now() } },
  }),
  [],
  'Repeated error alerts must be suppressed during the six-hour cooldown',
);

const liveCoachPath = option('--live-coach');
const liveMonitorPath = option('--live-monitor');
assert.equal(
  Boolean(liveCoachPath),
  Boolean(liveMonitorPath),
  '--live-coach and --live-monitor must be supplied together',
);

if (liveCoachPath && liveMonitorPath) {
  const liveCoach = JSON.parse(readFileSync(liveCoachPath, 'utf8'));
  const liveMonitor = JSON.parse(readFileSync(liveMonitorPath, 'utf8'));
  const exportedCoach = Array.isArray(liveCoach) ? liveCoach[0] : liveCoach;
  const exportedMonitor = Array.isArray(liveMonitor) ? liveMonitor[0] : liveMonitor;

  assertLiveWorkflow(coach, exportedCoach, ['Fetch coach briefing', 'Send coach briefing']);
  assertLiveWorkflow(monitor, exportedMonitor, ['Send error alert']);
  assert.equal(
    exportedCoach.settings.errorWorkflow,
    exportedMonitor.id,
    'Live coach briefing is not linked to the live error monitor',
  );
}

console.log(
  liveCoachPath
    ? 'OK: n8n source and live workflows match; publication, credentials and safety gates are valid'
    : 'OK: n8n workflow structure, contract, preview isolation and delivery gates are safe',
);
