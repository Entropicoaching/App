// Forsidens tre smaa SVG-grafer (ugentlig tonnage, e1RM pr. hovedloeft,
// 14-dages parathed) — flyttet uaendret ud af AthleteView.jsx (ordre 373).

// Søjlediagram over ugentlig tonnage (sum af vægt × reps pr. uge, seneste ~10
// uger). Seneste uge fremhæves; første/største/seneste søjle får værdi-label.
function WeeklyTonnageChart({ data }) {
  if (!data || data.length < 2) return null
  const W = 400, H = 120, PL = 6, PR = 6, PT = 16, PB = 18
  const max = Math.max(...data.map(d => d.total))
  if (!max) return null
  const bw = (W - PL - PR) / data.length
  const mono = 'IBM Plex Mono,monospace'
  const fmt = t => t >= 10000 ? `${Math.round(t / 1000)}t` : t >= 1000 ? `${(t / 1000).toFixed(1).replace('.', ',')}t` : `${Math.round(t)}`
  const maxIdx = data.findIndex(d => d.total === max)
  const labelIs = new Set([0, maxIdx, data.length - 1])
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(237,234,226,0.08)" strokeWidth="1" />
      {data.map((d, i) => {
        const h = (d.total / max) * (H - PT - PB)
        const x = PL + i * bw
        const last = i === data.length - 1
        return (
          <g key={d.weekStart}>
            <rect x={x + bw * 0.18} y={H - PB - h} width={bw * 0.64} height={Math.max(h, 1.5)}
              fill={last ? '#c8923a' : 'rgba(200,146,58,0.35)'} />
            {labelIs.has(i) && (
              <text x={x + bw / 2} y={H - PB - h - 4} textAnchor="middle" fontSize="7.5"
                fill={last ? '#edeae2' : '#7a7770'} fontFamily={mono}>{fmt(d.total)}</text>
            )}
            {(i === 0 || last) && (
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="7"
                fill="#4a4844" fontFamily={mono}>{d.weekStart.slice(5).replace('-', '/')}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Multi-linje graf over ugentligt bedste e1RM (Epley: vægt × (1 + reps/30))
// pr. hovedløft. Svarer på "bliver jeg stærkere?" direkte på forsiden.
function E1RMChart({ series }) {
  const drawn = series.filter(sr => sr.points.length >= 2)
  if (!drawn.length) return null
  const W = 400, H = 150, PL = 8, PR = 40, PT = 10, PB = 16
  const allKeys = [...new Set(drawn.flatMap(sr => sr.points.map(p => p.weekStart)))].sort()
  if (allKeys.length < 2) return null
  const allVals = drawn.flatMap(sr => sr.points.map(p => p.val))
  const minV = Math.min(...allVals), maxV = Math.max(...allVals)
  const range = (maxV - minV) || 1
  const x = k => PL + (allKeys.indexOf(k) / (allKeys.length - 1)) * (W - PL - PR)
  const y = v => PT + (1 - (v - minV) / range) * (H - PT - PB)
  const mono = 'IBM Plex Mono,monospace'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(237,234,226,0.08)" strokeWidth="1" />
      {drawn.map(sr => {
        const pts = sr.points.map(p => `${x(p.weekStart).toFixed(1)},${y(p.val).toFixed(1)}`).join(' ')
        const last = sr.points[sr.points.length - 1]
        return (
          <g key={sr.label}>
            <polyline points={pts} fill="none" stroke={sr.color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            {sr.points.map(p => <circle key={p.weekStart} cx={x(p.weekStart)} cy={y(p.val)} r="2" fill={sr.color} />)}
            <text x={x(last.weekStart) + 5} y={y(last.val) + 3} fontSize="7.5" fill={sr.color} fontFamily={mono}>
              {Math.round(last.val)}
            </text>
          </g>
        )
      })}
      {[allKeys[0], allKeys[allKeys.length - 1]].map((k, i) => (
        <text key={k} x={x(k)} y={H - 4} textAnchor={i === 0 ? 'start' : 'end'} fontSize="7" fill="#4a4844" fontFamily={mono}>
          {k.slice(5).replace('-', '/')}
        </text>
      ))}
    </svg>
  )
}

// ORDRE 100 commit 2: lille, stille 14-dages parathedskurve — samme
// visuelle sprog som E1RMChart ovenfor (én linje, ingen akser med tal ud
// over min og max). Bruges udelukkende på dagens gemte log.
function ReadinessSparkline({ points }) {
  if (points.length < 2) return null
  const W = 400, H = 70, PL = 22, PR = 4, PT = 8, PB = 4
  const vals = points.map(p => p.score)
  const minV = Math.min(...vals), maxV = Math.max(...vals)
  const range = (maxV - minV) || 1
  const mono = 'IBM Plex Mono,monospace'
  const x = i => PL + (i / (points.length - 1)) * (W - PL - PR)
  const y = v => PT + (1 - (v - minV) / range) * (H - PT - PB)
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', margin: '0.25rem 0' }}>
      <text x={PL - 3} y={PT + 5} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily={mono}>{Math.round(maxV)}</text>
      <text x={PL - 3} y={H - PB} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily={mono}>{Math.round(minV)}</text>
      <polyline points={pts} fill="none" stroke="#c8923a" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.score)} r={i === points.length - 1 ? 3.5 : 2} fill={i === points.length - 1 ? '#edeae2' : '#c8923a'} />
      ))}
    </svg>
  )
}

export { WeeklyTonnageChart, E1RMChart, ReadinessSparkline }
