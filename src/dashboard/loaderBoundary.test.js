import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const base = new URL('./', import.meta.url)
for (const loader of ['followUpLoader.mjs', 'rebaseFollowUpLoader.mjs']) {
 test(`${loader}: K-FUND1 rejects unknown import from exact approved component`, () => {
  const code = `import { registerHooks } from 'node:module';
   import { install } from './${loader}'; install();
   const home = new URL('./ForsideView.jsx', import.meta.url).href;
   registerHooks({load(url, context, next) {
    const result = next(url, context);
    if (url === home) return {...result, source: "import './not-a-pinned-dependency.mjs';\\n" + result.source};
    return result;
   }});
   await import('./ForsideView.jsx');`;
  const result = spawnSync(process.execPath, ['--input-type=module','-e',code], {cwd:fileURLToPath(base),encoding:'utf8'});
  assert.notEqual(result.status, 0, 'unknown component import must fail');
  assert.match(result.stderr, /Unapproved hermetic dependency: \.\/not-a-pinned-dependency\.mjs/);
 });
 test(`${loader}: rejects same basename in another directory`, () => {
  const dir = new URL(`./boundary-${loader}/`,base); mkdirSync(dir,{recursive:true});
  writeFileSync(new URL('ForsideView.jsx',dir), readFileSync(new URL('ForsideView.jsx',base)));
  const code = `import { install } from './${loader}'; install(); await import('./boundary-${loader}/ForsideView.jsx');`;
  const result = spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:fileURLToPath(base),encoding:'utf8'});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Unapproved/);
 });
}
