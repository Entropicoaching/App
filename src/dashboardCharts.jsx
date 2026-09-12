// Rene SVG-graf-komponenter delt mellem Dashboard.jsx og dens lazy-loadede
// underfaner. Udskilt fra dashboardShared.js i ordre 130 · commit 2 (separat
// fil, kun komponent-eksports) fordi react-refresh/only-export-components
// ellers slår ud på en fil der blander komponenter og almindelige konstanter.

export function LineChart({ series, height = 130 }) {
  const allPts = series.flatMap(s => s.data)
  if (!allPts.length) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em' }}>
      Ingen data endnu
    </div>
  )
  const ys = allPts.map(p => p.y)
  const rawMin = Math.min(...ys), rawMax = Math.max(...ys)
  const pad = (rawMax - rawMin) * 0.1 || 5
  const minY = rawMin - pad, maxY = rawMax + pad
  const rangeY = maxY - minY
  const W = 500, H = height, pL = 44, pR = 10, pT = 14, pB = 26
  const cW = W - pL - pR, cH = H - pT - pB
  const tx = (i, n) => pL + (n > 1 ? i / (n - 1) : 0.5) * cW
  const ty = v => pT + cH - ((v - minY) / rangeY) * cH
  const yTicks = [Math.round(rawMin), Math.round((rawMin + rawMax) / 2), Math.round(rawMax)]
  const xRef = series.find(s => s.data.length > 0)?.data || []
  const xIdxs = xRef.length <= 4 ? xRef.map((_, i) => i)
    : [0, Math.round((xRef.length - 1) / 3), Math.round((xRef.length - 1) * 2 / 3), xRef.length - 1]
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={ty(v)} x2={W - pR} y2={ty(v)} stroke="rgba(237,234,226,0.07)" strokeWidth="1" />
          <text x={pL - 5} y={ty(v) + 3.5} textAnchor="end" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
        </g>
      ))}
      {series.map((s, si) => {
        if (!s.data.length) return null
        const n = s.data.length
        const path = s.data.map((p, i) => `${i ? 'L' : 'M'}${tx(i, n).toFixed(1)},${ty(p.y).toFixed(1)}`).join('')
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5,3' : undefined} />
            {s.data.map((p, i) => <circle key={i} cx={tx(i, n)} cy={ty(p.y)} r="2.5" fill={s.color} />)}
          </g>
        )
      })}
      {xIdxs.filter((v, i, a) => a.indexOf(v) === i).map(i => (
        <text key={i} x={tx(i, xRef.length)} y={H - 4} textAnchor="middle" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">
          {xRef[i]?.label}
        </text>
      ))}
    </svg>
  )
}

export function BarChart({ bars, height = 110 }) {
  if (!bars.length) return null
  const maxVal = Math.max(...bars.map(b => b.value), 1)
  const W = 500, H = height, pL = 32, pR = 10, pT = 20, pB = 26
  const cW = W - pL - pR, cH = H - pT - pB
  const step = cW / bars.length
  const bw = Math.floor(step * 0.65)
  const yAt = v => pT + cH - (v / maxVal) * cH
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {[0, Math.round(maxVal / 2), maxVal].map((v, i) => (
        <g key={i}>
          <line x1={pL} y1={yAt(v)} x2={W - pR} y2={yAt(v)} stroke="rgba(237,234,226,0.05)" strokeWidth="1" />
          <text x={pL - 4} y={yAt(v) + 3.5} textAnchor="end" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
        </g>
      ))}
      {bars.map((bar, i) => {
        const x = pL + step * i + (step - bw) / 2
        const bh = Math.max(1, (bar.value / maxVal) * cH)
        const y = pT + cH - bh
        const fill = bar.highlight ? '#e05555' : '#c8923a'
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={bh} fill={fill} opacity="0.75" />
            {bar.value > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" fill={bar.highlight ? '#e05555' : '#7a7770'} fontSize="8" fontFamily="IBM Plex Mono">{bar.value}</text>}
            <text x={x + bw / 2} y={H - 4} textAnchor="middle" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{bar.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function ScatterPlot({ points, height = 130 }) {
  if (points.length < 3) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em' }}>
      Ikke nok data endnu
    </div>
  )
  const W = 500, H = height, pL = 44, pR = 16, pT = 16, pB = 30
  const cW = W - pL - pR, cH = H - pT - pB
  const ys = points.map(p => p.y)
  const minY = Math.min(...ys, -1), maxY = Math.max(...ys, 1)
  const rangeY = maxY - minY || 1
  const tx = v => pL + ((v - 20) / 80) * cW
  const ty = v => pT + cH - ((v - minY) / rangeY) * cH
  const yTicks = [-2, -1, 0, 1, 2].filter(v => v >= minY - 0.5 && v <= maxY + 0.5)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      <line x1={pL} y1={ty(0)} x2={W - pR} y2={ty(0)} stroke="rgba(237,234,226,0.13)" strokeWidth="1" strokeDasharray="4,3" />
      {yTicks.map(v => (
        <g key={v}>
          <line x1={pL} y1={ty(v)} x2={W - pR} y2={ty(v)} stroke="rgba(237,234,226,0.04)" strokeWidth="1" />
          <text x={pL - 4} y={ty(v) + 3.5} textAnchor="end" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{v > 0 ? '+' : ''}{v}</text>
        </g>
      ))}
      {[25, 50, 60, 75].map(v => (
        <g key={v}>
          <line x1={tx(v)} y1={pT} x2={tx(v)} y2={pT + cH} stroke={v === 60 ? 'rgba(224,85,85,0.2)' : 'rgba(237,234,226,0.04)'} strokeWidth="1" />
          <text x={tx(v)} y={H - 4} textAnchor="middle" fill="#4a4844" fontSize="9" fontFamily="IBM Plex Mono">{v}</text>
        </g>
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={tx(p.x)} cy={ty(p.y)} r="4.5" fill={p.x < 60 ? '#e05555' : '#6cba6c'} opacity="0.7" />
      ))}
    </svg>
  )
}
