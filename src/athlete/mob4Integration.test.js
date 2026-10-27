import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

// Executed in a reconstructed public source tree, never a live application.
const athlete = new URL('./', import.meta.url)
const probes = [
  { loader: './mob3Loader.mjs', target: './MobiliseringTab.jsx', error: 'Forbidden synthetic import: node:fs' },
  { loader: './mobilityTestLoader.mjs', target: './MobiliseringTab.jsx', error: 'Forbidden synthetic import: node:fs' },
  { loader: '../coachRydHarness.mjs', target: 'ProfilHoved.jsx', error: 'Unapproved dependency: node:fs.js', coach: true },
]
function child(probe, mutation) {
  const source = `
    import assert from 'node:assert/strict';
    import { registerHooks } from 'node:module';
    const loader = await import(${JSON.stringify(new URL(probe.loader, athlete).href)});
    const load = ${probe.coach ? "await loader.app()" : "(loader.install(), async () => import(" + JSON.stringify(new URL(probe.target, athlete).href) + "))"};
    ${mutation ? `registerHooks({load(url, context, next) {
      if (url.endsWith('/mobilityHelped.mjs')) return {format:'module', shortCircuit:true,
        source:'import "node:fs"; export const MobilityHelped = () => null; export const MobilityHelpedProfile = () => null;'};
      return next(url, context);
    }});
    await assert.rejects(load(${JSON.stringify(probe.target)}), error => error.message === ${JSON.stringify(probe.error)});` : `
    globalThis.localStorage = {getItem() { assert.fail('OFF read'); }, setItem() { assert.fail('OFF write'); }};
    const result = await load(${JSON.stringify(probe.target)});
    ${probe.coach ? `const tree = result({a:{id:'a',name:'Synthetic',status:'active'},profilesLastSeen:{},unreadCounts:{}}); assert.ok(tree);` : `
    const Tab = result.default;
    assert.equal(typeof Tab, 'function');
    const tree = Tab({mobilitetFokus:true,mobilityMode:'fokus'});
    assert.ok(tree.props.library);
    const helper = await import(new URL('../mobilityHelped.mjs', ${JSON.stringify(athlete.href)}));
    assert.equal(helper.DEFAULT_MOBILITY_HELPED, false);
    assert.equal(helper.MobilityHelped({athleteId:'a',date:'2026-10-27',exercises:[{id:'x',name:'X'}]}),null);
    const map = new Map(); const storage = {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
    assert.equal(helper.toggleHelped('a',{id:'x',name:'X'},'2026-10-27',storage).error,null);
    assert.equal(helper.readHelped('a',storage).rows[0].id,'x');`}
    `}
  `
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], { cwd: athlete, encoding: 'utf8', timeout: 10000 })
  assert.equal(result.status, 0, result.stdout + result.stderr)
}
for (const probe of probes) {
  test(probe.loader + ': actual component and helper remain importable with OFF storage guard', () => child(probe, false))
  test(probe.loader + ': actual newly permitted module still rejects filesystem imports', () => child(probe, true))
}
