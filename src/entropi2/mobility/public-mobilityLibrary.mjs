// APP-MOB2: presentation only. Entries reference the pinned APP-MOB1 catalog.
const groups = {
  Squat: [
    ['Dybde', 'Squat', ['sq-mob-2']],
    ['Hofteposition', 'Squat', ['sq-mob-3']],
  ],
  Bænkpres: [['Skulderposition', 'Bænkpres', ['bp-mob-2']]],
  Dødløft: [
    ['Hofteposition', 'Dødløft — Konventionel', ['dk-mob-3']],
    ['Hofteposition i sumo', 'Dødløft — Sumo', ['ds-mob-1']],
  ],
}
export const MARC_TEXT = 'Vælg øvelsen efter, hvad dit hovedløft kræver af dig. Prøv dig frem, og se, hvad der føles rigtigt for dig.'
export function mobilityLibrary(lift, library = {}) {
  if (!Object.hasOwn(groups, lift)) return []
  return groups[lift].map(([title, key, ids]) => {
    const catalog = (Array.isArray(library?.[key]) ? library[key] : [])
      .flatMap(slot => Array.isArray(slot?.options) ? slot.options : [])
    return {
      title,
      exercises: ids.flatMap(id => {
        const exercise = catalog.find(item => item?.id === id && typeof item.name === 'string')
        return exercise ? [{ id, name: exercise.name, label: exercise.label, explanation: MARC_TEXT }] : []
      }),
    }
  }).filter(group => group.exercises.length)
}

// Local schematic poses based on existing exercise descriptions, no remote assets.
const drawings = {
  'sq-mob-2': { head: [104, 33], body: 'M104 44 L94 76 L121 91 L128 116 M94 76 L70 113 L51 116 M102 52 L137 64', prop: 'M143 18 V119' },
  'sq-mob-3': { head: [94, 29], body: 'M94 40 L94 81 L65 99 L36 99 M94 81 L127 89 L127 113 M94 51 L69 73 M94 51 L119 72' },
  'bp-mob-2': { head: [92, 29], body: 'M92 40 L92 80 L77 115 M92 80 L111 115 M92 49 L133 56 L133 29 M92 49 L69 72', prop: 'M143 18 V119' },
  'dk-mob-3': { head: [98, 29], body: 'M98 40 L98 75 L127 86 L127 115 L144 115 M98 75 L68 111 L39 111 M98 50 L123 73' },
  'ds-mob-1': { head: [90, 32], body: 'M90 43 L90 77 L53 91 L43 116 L29 116 M90 77 L127 91 L137 116 L151 116 M90 51 L65 65 L90 67 L115 65 L90 51' },
}
export function exercisePicture(h, exercise) {
  const pose = drawings[exercise.id]
  if (!pose) return null
  return h('svg', { role: 'img', 'aria-label': `Skematisk billede: ${exercise.name}`, viewBox: '0 0 180 135', width: 180, height: 135, style: { display: 'block', width: '100%', maxWidth: 240, height: 'auto' } },
    h('title', null, `Skematisk billede: ${exercise.name}`),
    h('path', { d: 'M18 121 H162', stroke: '#736043', fill: 'none' }),
    pose.prop ? h('path', { d: pose.prop, stroke: '#d1c9b8', strokeWidth: 3, fill: 'none' }) : null,
    h('circle', { cx: pose.head[0], cy: pose.head[1], r: 9, stroke: '#e0ae5c', strokeWidth: 3, fill: 'none' }),
    h('path', { d: pose.body, stroke: '#e0ae5c', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }))
}
