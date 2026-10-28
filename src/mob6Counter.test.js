import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
const run = source => spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: new URL('./', import.meta.url), encoding: 'utf8', timeout: 10000 })
const profileProbe = baseline => `
  import assert from 'node:assert/strict';
  import { install } from './mob6Loader.mjs';
  import { mount, text } from './mob6Dom.mjs';
  install({baseline:${baseline}});
  globalThis.localStorage={getItem:()=>null};
  const Profile=(await import('./ProfilHoved.jsx')).default;
  const tree=mount(Profile,{mobilitetHjemme:true,a:{id:'a',name:'Synthetic',status:'active'},profilesLastSeen:{},unreadCounts:{}}).render();
  assert.match(text(tree), /Hjemmeøvelser til atleten/);
`
test('before FAIL on exact pinned profile, after PASS on final profile', () => {
  const before = run(profileProbe(true))
  assert.equal(before.status, 1, before.stdout + before.stderr)
  assert.match(before.stderr, /Hjemmeøvelser til atleten/)
  const after = run(profileProbe(false))
  assert.equal(after.status, 0, after.stdout + after.stderr)
})
test('new application dependency cannot import filesystem or network modules', () => {
  for (const forbidden of ['node:fs', 'node:http', './unknown.mjs']) {
    const child = run(`
      import assert from 'node:assert/strict';
      import { registerHooks } from 'node:module';
      import { install } from './mob6Loader.mjs';
      install();
      registerHooks({load(url,context,next){
        if(url.endsWith('/mobilityHomework.mjs')) return {format:'module',shortCircuit:true,source:'import ${JSON.stringify(forbidden)};'};
        return next(url,context);
      }});
      await assert.rejects(import('./mobilityHomework.mjs'), error=>error.message === ${JSON.stringify('Forbidden synthetic import: ' + forbidden)});
    `)
    assert.equal(child.status, 0, child.stdout + child.stderr)
  }
})
test('disabled actual profile performs no local reads and final modules parse in CRLF', () => {
  const child = run(`
    import assert from 'node:assert/strict';
    import { install } from './mob6Loader.mjs';
    import { mount, text } from './mob6Dom.mjs';
    install({lineEnding:'\\r\\n'});
    Object.defineProperty(globalThis,'localStorage',{get(){assert.fail('OFF storage getter')}});
    const Profile=(await import('./ProfilHoved.jsx')).default;
    assert.doesNotMatch(text(mount(Profile,{a:{id:'a',name:'Synthetic',status:'active'},profilesLastSeen:{},unreadCounts:{}}).render()), /Hjemmeøvelser til atleten/);
  `)
  assert.equal(child.status, 0, child.stdout + child.stderr)
})
