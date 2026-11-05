export function renderSyntheticBarPath(h, { result, error = '' } = {}) {
  const format = value => value.toLocaleString('da-DK', { maximumFractionDigits: 1 })
  const points = result?.points || [], observed = points.filter(point => point.status === 'tracked')
  const visible = points.filter(point => point.x !== null && point.y !== null)
  const minX = visible.length ? Math.min(...visible.map(point => point.x)) : 0
  const minY = visible.length ? Math.min(...visible.map(point => point.y)) : 0
  const width = visible.length ? Math.max(1, Math.max(...visible.map(point => point.x)) - minX) : 1
  const height = visible.length ? Math.max(1, Math.max(...visible.map(point => point.y)) - minY) : 1
  // One scale for both axes keeps the path's geometry intact.
  const scale = 240 / Math.max(width, height)
  const xy = point => `${10 + (point.x - minX) * scale},${10 + (point.y - minY) * scale}`
  const lines = []
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index]
    if (a.x === null || b.x === null || a.segment !== b.segment || b.time - a.time > result.maxGapSeconds) continue
    const estimated = a.status !== 'tracked' || b.status !== 'tracked'
    lines.push(h('polyline', { key: index, points: `${xy(a)} ${xy(b)}`, fill: 'none', stroke: estimated ? '#c8923a' : '#b3c5a0',
      strokeWidth: 2, ...(estimated ? { strokeDasharray: '5 4' } : {}) }))
  }
  return h('details', { 'data-entropi2-synthetic-bar-path': '' },
    h('summary', { style: { minHeight: 44, cursor: 'pointer' } }, 'Syntetisk stangbane'),
    h('p', null, 'Kun syntetiske målepunkter. Ingen video analyseres her.'),
    error ? h('p', { role: 'alert' }, error) : !result || result.status === 'empty'
      ? h('p', { role: 'status' }, 'Ingen syntetisk stangbane endnu.')
      : result.status === 'unavailable' ? h('p', { role: 'status' }, 'Skiven blev ikke fundet i de syntetiske målepunkter.') : null,
    !error && observed.length > 0 && h('div', null,
      h('p', { role: 'status' }, `${result.counts.tracked} målte · ${result.counts.estimated} estimerede · ${result.counts.lost} tabte punkter. ${result.counts.rejected} spring afvist.`),
      h('svg', { viewBox: '0 0 260 260', role: 'img', 'aria-label': 'Syntetisk stangbane med stiplede estimater', style: { width: '100%', maxWidth: 300, height: 'auto' } },
        ...lines, ...observed.map((point, index) => h('circle', { key: `p${index}`, cx: 10 + (point.x - minX) * scale, cy: 10 + (point.y - minY) * scale, r: 2, fill: '#b3c5a0' }))),
      h('p', null, 'Fuld linje: udglattede målepunkter. Stiplet: usikkert estimat, højst 0,25 s. Lange tab vises som huller.'),
      result.segments > 1 && h('p', null, `${result.segments} adskilte banestykker. Genfinding efter et langt tab er ubekræftet.`),
      h('p', null, result.calibration.status === 'known'
        ? `Skala fra kendt skive på 45 cm (${format(result.calibration.diameterPx)} px). Perspektiv og kamerabevægelse kan påvirke målingen.`
        : result.calibration.status === 'unstable' ? 'Skivediameteren varierer for meget. Skalaen er usikker; kun pixels vises.'
          : 'Skala ukendt. Angiv en kendt skive på 45 cm og dens diameter; indtil da vises kun pixels.'),
      result.verticalRange && h('p', null, `Observeret lodret spænd: ${format(result.verticalRange.value)} ${result.verticalRange.unit}. Kun målte punkter tælles med.`),
      h('p', null, 'Udglatning og genfinding er estimater, ikke et bevis for præcision. Dette er ikke en vurdering af løfteteknik.')))
}
