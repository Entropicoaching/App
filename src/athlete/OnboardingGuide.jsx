// Onboarding-guiden (klik-guiden ved foerste login, kan genaabnes fra
// kontomenuen) — flyttet uaendret ud af AthleteView.jsx (ordre 373).
// Betingelsen for at vise den staar stadig i AthleteView.
import { ATHLETE_ONBOARDING_GUIDE_STEPS, isLastOnboardingGuideStep } from '../athleteOnboardingGuide'
import { s } from '../athleteShared'

function OnboardingGuide({
  advanceOnboardingGuide, athlete, completeOnboardingGuide, currentWeek, guideStep,
}) {
    const guideStepData = ATHLETE_ONBOARDING_GUIDE_STEPS[guideStep] || ATHLETE_ONBOARDING_GUIDE_STEPS[0]
    const isIntroStep = guideStepData.variant === 'intro'
    const isLastGuideStep = isLastOnboardingGuideStep(guideStep)
    return (
      <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: '460px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', marginBottom: '2.75rem', letterSpacing: '0.02em' }}>
            Entropi<span style={{ color: '#c8923a' }}>.</span>
          </div>

          {isIntroStep ? (
            <>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.1rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '1rem' }}>
                Velkommen, <em style={{ fontStyle: 'italic', color: '#c8923a' }}>{athlete.name.split(' ')[0]}</em>.
              </h1>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.92rem', color: '#7a7770', lineHeight: 1.75, marginBottom: '2.5rem' }}>
                {guideStepData.body}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2.5rem' }}>
                {[
                  {
                    label: 'Program',
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="6" y1="12" x2="18" y2="12" /><rect x="2" y="9.5" width="4" height="5" rx="1" /><rect x="18" y="9.5" width="4" height="5" rx="1" /><line x1="4" y1="9.5" x2="4" y2="14.5" /><line x1="20" y1="9.5" x2="20" y2="14.5" />
                      </svg>
                    ),
                  },
                  {
                    label: 'Kostlog',
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><line x1="7" y1="2" x2="7" y2="22" /><path d="M21 15V2a5 5 0 0 0-5 5v6h3v7a1 1 0 0 0 2 0V15z" />
                      </svg>
                    ),
                  },
                  {
                    label: 'Readiness',
                    icon: (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    ),
                  },
                ].map(({ label, icon }) => (
                  <div key={label} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.5rem 0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ color: '#c8923a' }}>{icon}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7a7770' }}>{label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.85rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.2, marginBottom: '1rem' }}>
                {guideStepData.heading}
              </h1>
              <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.92rem', color: '#7a7770', lineHeight: 1.75, marginBottom: '2.75rem' }}>
                {guideStepData.body}
              </p>
            </>
          )}

          {/* Trin-indikator */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '2rem' }}>
            {ATHLETE_ONBOARDING_GUIDE_STEPS.map((step, index) => (
              <span key={step.key} style={{ width: '6px', height: '6px', borderRadius: '50%', background: index === guideStep ? '#c8923a' : 'rgba(237,234,226,0.15)' }} />
            ))}
          </div>

          <button
            onClick={advanceOnboardingGuide}
            style={{ ...s.btnPrimary, fontSize: '0.7rem', padding: '0.85rem 2.75rem', letterSpacing: '0.14em' }}
          >
            {isLastGuideStep ? (currentWeek ? 'Se dit program →' : 'Gå til forsiden →') : 'Videre →'}
          </button>

          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={completeOnboardingGuide}
              style={{ background: 'none', border: 'none', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', padding: '0.4rem' }}
            >
              Spring guiden over
            </button>
          </div>
        </div>
      </div>
    )
}

export default OnboardingGuide
