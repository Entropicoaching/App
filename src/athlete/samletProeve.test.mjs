import test from 'node:test'
import assert from 'node:assert/strict'
import { assertCleanMarkup, assertNoWriteButtons, elements, nodeText, markupTree } from './samletProeveMarkup.mjs'
import { dispose, importedModules, renderScenario, scenario, tabs, week } from './samletProeveFixture.mjs'

test.after(dispose)

test('the test loader imports the actual local stylesheet without executing CSS', async () => {
  const styles = await import('./PasOverblikStyles.css')
  assert.deepEqual(styles.default, {})
  assert.ok(importedModules.has(new URL('./PasOverblikStyles.css', import.meta.url).href))
})

const modes = ['athlete', 'preview', 'own']
const pageMarkers = {
  hjem: /data-entropi2-home-session/, program: /Testpas/,
  fremgang: /data-entropi2-analysis/, kost: /data-entropi2-kost/,
  beskeder: /aria-label="Samlet samtale"/, profil: /data-entropi2-profile/,
  volumen: /data-entropi2-volume/,
}

for (const mode of modes) for (const tab of tabs) for (const state of ['ready', 'empty', 'loading', 'error']) {
  test(`samlet SSR: ${mode}/${tab}/${state}`, async () => {
    const html = await renderScenario(scenario(mode, tab, state))
    const tree = assertCleanMarkup(html)
    if (state === 'loading' || state === 'error') {
      assert.match(nodeText(tree), state === 'loading' ? /Henter dataene/ : /Dataene kunne ikke hentes/)
      assert.doesNotMatch(html, /data-entropi2-athlete|data-entropi2-profile/)
      return
    }
    assert.match(html, /data-entropi2-athlete/)
    if (tab === 'profil' && mode === 'preview') {
      assert.doesNotMatch(html, /data-entropi2-profile|Profil og dataeksport/)
      assert.match(html, /Forhåndsvisning/)
    } else if (state === 'ready' || !['program'].includes(tab)) {
      assert.match(html, pageMarkers[tab], `Wrong page: ${mode}/${tab}/${state}`)
    }
    if (tab === 'hjem') {
      const h1 = elements(tree).find(node => node.tag === 'h1')
      assert.ok(h1, 'Home greeting is absent')
      assert.match(nodeText(h1), /Testfornavn/)
      assert.doesNotMatch(nodeText(h1), /Testefternavn/)
      if (state === 'empty') {
        assert.match(nodeText(h1), /Dit overblik, Testfornavn/)
        assert.match(nodeText(tree), /Intet program endnu/)
      }
    }
    if (state === 'empty' && tab === 'program') assert.match(nodeText(tree), /Dit program er på vej/)
    if (state === 'empty' && tab === 'volumen') assert.match(nodeText(tree), /ikke gennemført sæt i disse to uger/)
    if (mode === 'preview') assert.match(html, /<fieldset[^>]*disabled=""[^>]*aria-label="Atletvisning uden skrivninger"/)
    else assert.doesNotMatch(html, /<fieldset[^>]*disabled/)
  })
}

for (const mode of modes) {
  test(`F6: empty Fremgang renders without a program: ${mode}`, async () => {
    const html = await renderScenario(scenario(mode, 'fremgang', 'empty'))
    const tree = markupTree(html)
    assert.match(html, /data-entropi2-analysis/)
    assert.match(nodeText(tree), /Din udvikling kommer frem, når du logger vægt og gentagelser i programmet/)
    assert.doesNotMatch(nodeText(tree), /undefined|NaN|\[object Object\]/)
  })
}

for (const mode of modes) for (const tab of ['hjem', 'program']) {
  test(`partial program failure stays distinct from empty: ${mode}/${tab}`, async () => {
    const html = await renderScenario(scenario(mode, tab, 'empty', { programError: true }))
    const tree = assertCleanMarkup(html)
    assert.match(nodeText(tree), tab === 'hjem' ? /Programmet er ikke tilgængeligt/ : /Dit program kunne ikke hentes/)
    assert.doesNotMatch(nodeText(tree), /Intet program endnu|Dit program er på vej/)
  })
}

for (const mode of modes) {
  test(`source loading within the page: ${mode}/analysis`, async () => {
    const analysis = await renderScenario(scenario(mode, 'fremgang', 'ready', { fremgangLoading: true, fremgangLogs: null }))
    assert.match(analysis, /Henter din udvikling/)
    assertCleanMarkup(analysis)
  })
  test(`source loading within the page: ${mode}/volume`, async () => {
    const volume = await renderScenario(scenario(mode, 'volumen', 'ready', { volumeLoading: true, volumeLogs: [] }))
    assertCleanMarkup(volume)
    assert.match(volume, /Henter din volumen/)
  })
}

test('host-imported presentation modules remain actual source modules', () => {
  for (const path of ['AthleteView.jsx', 'athlete/Ramme.jsx', 'athlete/BundNav.jsx', 'athlete/ProgramTab.jsx',
    'athlete/VolumenTab.jsx', 'entropi2/home/HomeSession.mjs', 'entropi2/home/AthleteHome.mjs',
    'entropi2/analysis/Analysis.mjs', 'entropi2/Entropi2Kost.mjs', 'entropi2/conversation/Conversation.mjs',
    'entropi2/profile/ProfilePage.mjs']) {
    assert.ok([...importedModules].some(url => url.endsWith('/src/' + path)), `Presentation was replaced: ${path}`)
  }
})

// Known requirements remain executable TODOs; no blanket catch, skip or automatic
// conversion of arbitrary assertion failures to TODO is allowed.
test('TODO F1: SSR Kost contains real content, including empty-data guidance', {
  todo: 'F1: src/entropi2/Entropi2Kost.mjs:35-47 and src/AthleteView.jsx:119-126 mount content only in useEffect; SSR emits an empty div.',
}, async () => {
  for (const mode of modes) for (const state of ['ready', 'empty']) {
    const tree = assertCleanMarkup(await renderScenario(scenario(mode, 'kost', state)))
    const kost = elements(tree).find(node => /\bdata-entropi2-kost=/.test(node.attributes ?? ''))
    assert.ok(kost && nodeText(kost), `Empty nutrition screen: ${mode}/${state}`)
  }
})

test('TODO F2: SSR Beskeder includes the fetched conversation or honest empty state', {
  todo: 'F2: src/entropi2/conversation/Conversation.mjs:7-15 mounts content only in useEffect; SSR emits an empty section.',
}, async () => {
  for (const mode of modes) for (const state of ['ready', 'empty']) {
    const tree = assertCleanMarkup(await renderScenario(scenario(mode, 'beskeder', state)))
    const conversation = elements(tree).find(node => /aria-label="Beskeder og video"/.test(node.attributes ?? ''))
    assert.ok(conversation && nodeText(conversation), `Empty conversation: ${mode}/${state}`)
    if (state === 'ready') assert.match(nodeText(conversation), /Syntetisk besked fra din coach/)
  }
})

// Home and the preview Profile fallback still expose disabled write controls.
// Keep these requirements executable until their own presentation is addressed.
for (const tab of ['hjem', 'profil']) {
  test(`TODO F3: preview/${tab} has no write buttons, including disabled buttons`, {
    todo: 'F3: Home and the preview Profile fallback still render visible write buttons.',
  }, async () => {
    for (const state of ['ready', 'empty']) {
      const html = await renderScenario(scenario('preview', tab, state))
      assertNoWriteButtons(html)
      assertCleanMarkup(html)
    }
  })
}
for (const tab of ['program', 'fremgang']) {
  test(`F3: preview/${tab} has no write buttons, including disabled buttons`, async () => {
    for (const state of ['ready', 'empty']) {
      const html = await renderScenario(scenario('preview', tab, state))
      assertNoWriteButtons(html)
      assertCleanMarkup(html)
    }
  })
}
for (const tab of ['kost', 'beskeder', 'volumen']) {
  test(`preview/${tab} has no write buttons`, async () => {
    const html = await renderScenario(scenario('preview', tab))
    assertCleanMarkup(html)
    assertNoWriteButtons(html)
  })
}

// Explicit OFF is never written to source or enabled by this test adapter.
test('explicit OFF keeps the host E2 branch off on Home', async () => {
  for (const mode of modes) {
    const input = scenario(mode, 'hjem')
    input.props.entropi2 = false
    const html = await renderScenario(input)
    // Static CSS also mentions these selectors when OFF; inspect element attributes.
    for (const node of elements(assertCleanMarkup(html))) {
      assert.notEqual(node.tag, 'fieldset')
      assert.doesNotMatch(node.attributes ?? '', /\bdata-entropi2-(?:athlete|home-session|profile)=/)
    }
  }
})

test('first-name greeting also survives a completed session', async () => {
  const exerciseLogs = [1, 2, 3].map(set_number => ({ exercise_id: week.sessions[0].exercises[0].id,
    set_number, logged_at: '2026-11-04T09:00:00Z', weight: 60, reps_completed: 3 }))
  for (const mode of modes) {
    const tree = assertCleanMarkup(await renderScenario(scenario(mode, 'hjem', 'ready', { exerciseLogs })))
    const h1 = elements(tree).find(node => node.tag === 'h1')
    assert.match(nodeText(h1), /Godt arbejde i dag, Testfornavn/)
    assert.doesNotMatch(nodeText(h1), /Testefternavn/)
  }
})

test('F4: a failed first volume read must not claim a successful empty log', async () => {
  for (const mode of modes) {
    // The reader sets this real host error state; the existing toast may expire.
    for (const flash of [null, { kind: 'error', message: 'Din volumen kunne ikke hentes. Tjek din forbindelse og prøv igen.' }]) {
      const input = scenario(mode, 'volumen', 'empty', { volumeLoading: false, volumeError: true, flash })
      const html = await renderScenario(input)
      const tree = assertCleanMarkup(html)
      assert.match(nodeText(tree), /Din volumen kunne ikke hentes/)
      assert.match(html, /role="alert"/)
      assert.doesNotMatch(nodeText(tree), /Du har ikke gennemført sæt i disse to uger/)
    }
  }
})
