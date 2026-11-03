export const weekPlanStyles = {
  section: { width: '100%', minWidth: 0, boxSizing: 'border-box', color: '#edeae2',
    fontFamily: "'IBM Plex Sans', Arial, sans-serif" },
  heading: { margin: '0 0 12px', fontSize: 20, lineHeight: 1.3 },
  list: { listStyle: 'none', margin: 0, padding: 0 },
  row: { display: 'grid', gridTemplateColumns: '5rem minmax(0, 1fr) max-content',
    gap: 8, alignItems: 'center', minHeight: 44, borderBottom: '1px solid #414139',
    fontSize: 14, lineHeight: 1.4 },
  day: { color: '#b8b4a8', whiteSpace: 'nowrap', fontSize: 12 },
  name: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 },
  status: { whiteSpace: 'nowrap', fontSize: 12, color: '#edeae2' },
  done: { whiteSpace: 'nowrap', fontSize: 12, color: '#b9d5a0' },
  message: { color: '#b8b4a8', fontSize: 14, lineHeight: 1.5, margin: 0 },
}
