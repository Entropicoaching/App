#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const html = readFileSync(join(root, 'public', 'videocoach.html'));
const source = html.toString('utf8');
const explanation = 'Kræver mindst 2 analyserede reps';

for (const contract of [
  'function olderRepsAvailable(path)',
  "return (path?.analysis?.reps?.length || 0) >= 2",
  'button.disabled = !available',
  "button.setAttribute('aria-disabled', String(!available))",
  'if (!syncOlderRepsAffordance(path)) return false',
  explanation,
]) assert.ok(source.includes(contract), `mangler kontrakt: ${contract}`);

const require = createRequire(import.meta.url);
const runtimeModules = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
  'dependencies', 'node', 'node_modules');
const { chromium } = require(join(runtimeModules, 'playwright'));
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname;
  const isWorker = path === '/sw.js';
  const body = isWorker ? readFileSync(join(root, 'public', 'sw.js')) : html;
  response.writeHead(200, {'content-type':isWorker ? 'text/javascript' : 'text/html; charset=utf-8',
    'cache-control':'no-store'});
  response.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const browserExecutable = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);
assert.ok(browserExecutable, 'lokal Chrome/Edge mangler til browser-gaten');
const browser = await chromium.launch({headless:true, executablePath:browserExecutable});
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/videocoach.html?hotfix=${Date.now()}`,
      {waitUntil:'domcontentloaded'});

    const result = await page.evaluate(() => {
      const button = document.getElementById('vcToggleHistory');
      const hint = document.getElementById('vcOlderRepsHint');
      const oneRep = {analysis:{reps:[{}]}};
      const twoReps = {analysis:{reps:[{},{}]}};
      document.getElementById('barPathHUD').hidden = false;
      syncOlderRepsAffordance(oneRep);
      const before = cleanOverlayState.history;
      const oneActivated = toggleOlderReps(oneRep);
      const disabled = {
        native:button.disabled,
        aria:button.getAttribute('aria-disabled'),
        pressed:button.getAttribute('aria-pressed'),
        active:button.classList.contains('active'),
        hint:hint.hidden ? '' : hint.textContent.trim(),
        title:button.title,
        stateUnchanged:cleanOverlayState.history === before,
        oneActivated,
      };
      syncOlderRepsAffordance(twoReps);
      const enabledBefore = {
        native:button.disabled,
        aria:button.getAttribute('aria-disabled'),
        pressed:button.getAttribute('aria-pressed'),
        hintHidden:hint.hidden,
      };
      const twoActivated = toggleOlderReps(twoReps);
      const enabledAfter = {
        pressed:button.getAttribute('aria-pressed'),
        active:button.classList.contains('active'),
        stateChanged:cleanOverlayState.history !== before,
        twoActivated,
      };
      return {disabled, enabledBefore, enabledAfter,
        overflow:document.documentElement.scrollWidth <= document.documentElement.clientWidth};
    });

    assert.deepEqual(result.disabled, {
      native:true, aria:'true', pressed:'false', active:false, hint:explanation,
      title:explanation, stateUnchanged:true, oneActivated:false,
    });
    assert.deepEqual(result.enabledBefore, {
      native:false, aria:'false', pressed:'true', hintHidden:true,
    });
    assert.deepEqual(result.enabledAfter, {
      pressed:'false', active:false, stateChanged:true, twoActivated:true,
    });
    assert.equal(result.overflow, true, `${width}: viewport overflow`);
    assert.deepEqual(errors, [], `${width}: consolefejl: ${errors.join(' | ')}`);
    await page.close();
    console.log(`${width}: accessibility og overflow PASS`);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('1 rep disabled');
console.log('2 reps enabled');
console.log(explanation);
