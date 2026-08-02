// Små byggeklodser til abonnementsprototypen. Mobil først: alle trykflader er
// mindst 44px høje, og intet kræver præcision med en mus.

import { color, font } from './theme'

const DEFAULT_TABS = [
  { id: 'today', label: 'I dag' },
  { id: 'history', label: 'Historik' },
  { id: 'profile', label: 'Profil' },
]

const focusStyles = `
  [data-entropi-focus]:focus-visible {
    outline: 2px solid ${color.accent} !important;
    outline-offset: 2px;
  }
`

export function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: color.panel,
        border: `1px solid ${color.line}`,
        padding: '1rem',
        marginBottom: '1rem',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Label({ children, tone = 'accent' }) {
  return (
    <div
      style={{
        fontFamily: font.mono,
        fontSize: '0.62rem',
        fontWeight: 500,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: tone === 'accent' ? color.accent : color.muted,
        marginBottom: '0.6rem',
      }}
    >
      {children}
    </div>
  )
}

export function Meta({ children, style, ...props }) {
  return (
    <div
      {...props}
      style={{
        fontFamily: font.mono,
        fontSize: '0.62rem',
        letterSpacing: '0.08em',
        color: color.muted,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, style, type = 'button', ...props }) {
  const base = {
    width: '100%',
    minHeight: '48px',
    fontFamily: font.mono,
    fontSize: '0.62rem',
    fontWeight: 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '0.75rem 1rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'opacity 0.15s',
  }
  const variants = {
    primary: { background: color.accent, color: color.bg, border: 'none' },
    ghost: {
      background: 'transparent',
      color: color.muted,
      border: `1px solid ${color.lineStrong}`,
    },
    soft: {
      background: color.accentSoft,
      color: color.accent,
      border: `1px solid ${color.accentBorder}`,
    },
  }
  return (
    <button {...props} type={type} data-entropi-focus disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  )
}

// Valgliste til onboarding: ét tryk vælger, valget er synligt uden at scrolle.
export function ChoiceList({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <button
            type="button"
            data-entropi-focus
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              minHeight: '52px',
              background: active ? color.accentSoft : color.panel,
              border: `1px solid ${active ? color.accentBorder : color.lineStrong}`,
              color: active ? color.accent : color.text,
              fontFamily: font.sans,
              fontSize: '0.95rem',
              fontWeight: 300,
              padding: '0.7rem 0.9rem',
              cursor: 'pointer',
            }}
          >
            {opt.label}
            {opt.note && (
              <span
                style={{
                  display: 'block',
                  fontFamily: font.mono,
                  fontSize: '0.62rem',
                  letterSpacing: '0.06em',
                  color: color.muted,
                  marginTop: '0.25rem',
                }}
              >
                {opt.note}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Tal-stepper med store knapper — hurtigere end et tastatur mellem sæt, og
// tastaturet dækker ikke skærmen i træningscenteret.
export function Stepper({ label, value, unit, step = 1, min = 0, max = 999, onChange }) {
  const btn = {
    width: '56px',
    minHeight: '48px',
    background: color.panel,
    border: `1px solid ${color.lineStrong}`,
    color: color.text,
    fontFamily: font.mono,
    fontSize: '1.1rem',
    cursor: 'pointer',
    flexShrink: 0,
  }
  const clamp = v => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div style={{ marginBottom: '0.9rem' }}>
      <Meta style={{ marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </Meta>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem' }}>
        <button type="button" data-entropi-focus style={btn} onClick={() => onChange(clamp(value - step))} aria-label={`${label} ned`}>
          −
        </button>
        <label
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '0.3rem',
            background: color.bg,
            border: `1px solid ${color.lineStrong}`,
          }}
        >
          <input
            data-entropi-focus
            aria-label={label}
            inputMode="decimal"
            value={value}
            onChange={event => {
              const next = event.target.value.replace(',', '.')
              if (next === '' || /^\d*\.?\d*$/.test(next)) onChange(next === '' ? 0 : clamp(Number(next)))
            }}
            style={{ width: '5.2rem', background: 'transparent', border: 'none', padding: 0, color: color.text, fontFamily: font.display, fontSize: '1.6rem', textAlign: 'right' }}
          />
          {unit && (
            <span style={{ fontFamily: font.mono, fontSize: '0.62rem', color: color.muted }}>
              {unit}
            </span>
          )}
        </label>
        <button type="button" data-entropi-focus style={btn} onClick={() => onChange(clamp(value + step))} aria-label={`${label} op`}>
          +
        </button>
      </div>
    </div>
  )
}

// RPE som chips: ti tryk er værre end ét, og skalaen er kort nok til at vise hel.
export function ChipRow({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: '0.9rem' }}>
      <Meta style={{ marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </Meta>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = opt === value
          return (
            <button
              type="button"
              data-entropi-focus
              key={String(opt)}
              onClick={() => onChange(opt)}
              aria-pressed={active}
              style={{
                flex: '1 1 0',
                minWidth: '44px',
                minHeight: '48px',
                background: active ? color.accentSoft : color.panel,
                border: `1px solid ${active ? color.accentBorder : color.lineStrong}`,
                color: active ? color.accent : color.muted,
                fontFamily: font.mono,
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TabBar({ tab, onChange, tabs = DEFAULT_TABS, label = 'Primær navigation' }) {
  return (
    <nav
      aria-label={label}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: color.panel,
        borderTop: `1px solid ${color.line}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 40,
      }}
    >
      {tabs.map(t => (
        <button
          type="button"
          data-entropi-focus
          key={t.id}
          onClick={() => onChange(t.id)}
          aria-current={tab === t.id ? 'page' : undefined}
          style={{
            flex: 1,
            minHeight: '56px',
            background: 'transparent',
            border: 'none',
            borderTop: `2px solid ${tab === t.id ? color.accent : 'transparent'}`,
            color: tab === t.id ? color.accent : color.muted,
            fontFamily: font.mono,
            fontSize: '0.62rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

export function TopBar({ title, right }) {
  return (
    <>
      <style>{focusStyles}</style>
      <header
      style={{
        height: '52px',
        borderBottom: `1px solid ${color.line}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        background: color.panel,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
      >
        <span style={{ fontFamily: font.display, fontSize: '1rem', color: color.text }}>{title}</span>
        {right}
      </header>
    </>
  )
}
