import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workflow = JSON.parse(readFileSync(join(here, 'coach-briefing-v1.json'), 'utf8'));
const node = (name) => {
  const match = workflow.nodes.find((candidate) => candidate.name === name);
  if (!match) throw new Error(`Missing workflow node: ${name}`);
  return match;
};

const runCode = (code, { input, mode = 'production', config = {}, state = {} }) => {
  const execute = new Function('$input', '$execution', '$', '$getWorkflowStaticData', code);
  return execute(
    { first: () => input },
    { mode },
    () => ({ first: () => ({ json: config }) }),
    () => state,
  );
};

const now = Date.now();
const data = {
  schema_version: 1,
  generated_at: new Date(now).toISOString(),
  coach_id: 'coach-preview',
  unread_messages: [
    {
      athlete_id: 'message-old',
      athlete_name: 'Anna',
      track: 'Besked',
      unread_count: 2,
      latest_at: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
    },
    {
      athlete_id: 'message-unknown',
      athlete_name: 'Emil',
      track: 'Teknik',
      unread_count: 1,
      latest_at: 'not-a-timestamp',
    },
  ],
  video_drafts: [
    {
      id: 'video-old',
      athlete_id: 'video-athlete',
      athlete_name: 'Jonas',
      lift: 'Dødløft',
      created_at: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
    },
  ],
  training_signals: [
    {
      athlete_id: 'alert-athlete',
      athlete_name: 'Sofie',
      severity: 'alert',
      detector: 'readiness',
      detail: 'Restitution kræver et blik',
    },
  ],
};
const config = {
  coachId: 'coach-preview',
  coachEmail: 'coach@example.invalid',
  appUrl: 'https://example.invalid/?coach=inbox&focus=next',
};

const kept = runCode(node('Keep unresolved backup items').parameters.jsCode, {
  input: { json: data },
  config,
});
if (kept.length !== 1) throw new Error('Preview fixture produced no unresolved items');

const built = runCode(node('Build briefing').parameters.jsCode, {
  input: kept[0],
  config,
});
const framed = runCode(node('Frame fallback email').parameters.jsCode, {
  input: built[0],
  config,
});
const preview = framed[0].json;

const port = Number.parseInt(process.env.PORT ?? '4179', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');

const server = createServer((request, response) => {
  if (request.url === '/meta') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      subject: preview.subject,
      total: preview.total,
      digest: preview.digestHash,
      priorityVersion: preview.priorityVersion,
    }, null, 2));
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(preview.html);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Coach briefing preview: http://127.0.0.1:${port}`);
});
