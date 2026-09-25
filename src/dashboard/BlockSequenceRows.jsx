// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// Blok-sekvens-editoren i kalenderens blok-bygger (blockSequenceRows).
// Samme navne som props som i Dashboard; kun kroppen er flyttet.
import { blockColor, s, BLOCK_NAMES } from '../dashboardShared'
import { blockPurpose } from '../periodizationAssistant'

export default function BlockSequenceRows({
  blockPlan, setBlockPlan,
}) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {blockPlan.map((block, i) => (
          <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: blockColor(block.name), flexShrink: 0 }} />
            <select
              value={block.name}
              onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, name: e.target.value, description: blockPurpose(e.target.value) } : b))}
              style={{ ...s.fieldSelect, width: '160px', padding: '0.35rem 0.6rem', fontSize: '0.72rem' }}
            >
              {BLOCK_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number" min="1" max="20"
                value={block.weeks}
                onChange={e => setBlockPlan(p => p.map((b, j) => j === i ? { ...b, weeks: Math.max(1, parseInt(e.target.value) || 1) } : b))}
                style={{ ...s.fieldInput, width: '52px', padding: '0.35rem 0.5rem', fontSize: '0.72rem', textAlign: 'center' }}
              />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>uge{block.weeks !== 1 ? 'r' : ''}</span>
            </div>
            <button onClick={() => setBlockPlan(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: '0.1rem 0.3rem' }}>✕</button>
          </div>
        ))}
        <button
          onClick={() => setBlockPlan(p => [...p, { id: Date.now(), name: BLOCK_NAMES[0], weeks: 2, description: blockPurpose(BLOCK_NAMES[0]) }])}
          style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.7rem', alignSelf: 'flex-start', marginTop: '0.25rem' }}
        >+ Tilføj blok</button>
      </div>
    )
}
