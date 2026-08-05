// Forsiden — det første en ny bruger møder.
//
// Opgaven er ÉN ting: gøre forskellen på de to søjler tydelig, så valget er
// oplyst inden guiden går i gang. Jf. status/APP-FLOW.md i Control Tower er
// forskellen ikke antallet af programmer — det er om programmet tilpasser sig.
// Gratis er en åben ende, betalt er en løkke.
//
// Indholdet af de to søjler LÆSES fra entitlement-modellen. Skriver man dem af
// i hånden, kan forsiden komme til at love noget can() ikke giver.

import { color, font, s } from '../theme'
import { Button, Card, Label, Meta, TopBar } from '../ui'
import { featureSummary, TIER_LABEL } from '../entitlements'
import { CHECKOUT_AVAILABLE, PRICE_CONFIRMED, priceLabel } from '../pricing'

function FeatureRow({ label, included }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        padding: '0.35rem 0',
        fontSize: '0.85rem',
        lineHeight: 1.45,
        color: included ? color.text : color.dim,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: font.mono,
          fontSize: '0.8rem',
          lineHeight: 1.45,
          color: included ? color.good : color.dim,
          flexShrink: 0,
        }}
      >
        {included ? '+' : '–'}
      </span>
      {/* Skærmlæsere skal ikke gætte hvad et plus og et minus betyder. */}
      <span style={{ textDecoration: included ? 'none' : 'line-through' }}>
        <span
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {included ? 'Inkluderet: ' : 'Ikke inkluderet: '}
        </span>
        {label}
      </span>
    </li>
  )
}

// fremhaevet = salgsfremhævning. ditNiveau = brugerens faktiske tilstand.
// De to må ALDRIG se ens ud: Marc læste den fremhævede kasse som "det er det
// medlemskab jeg har", og det var den ikke — den var bare den vi sælger.
// Har brugeren et niveau, vinder tilstanden over salget.
function TierCard({ tier, pris, fremhaevet, ditNiveau, children }) {
  const markeret = ditNiveau || fremhaevet
  return (
    <Card
      style={{
        border: `1px solid ${ditNiveau ? color.good : markeret ? color.accentBorder : color.line}`,
        background: markeret ? color.accentSoft : color.panel,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
        <h2 style={{ ...s.h2, fontSize: '1.1rem' }}>{TIER_LABEL[tier]}</h2>
        <Meta style={{ color: markeret ? color.accent : color.muted, whiteSpace: 'nowrap' }}>{pris}</Meta>
      </div>
      {ditNiveau && (
        <Meta style={{ color: color.good, marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
          ← Dit niveau
        </Meta>
      )}
      {children}
      <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
        {featureSummary(tier).map(f => (
          <FeatureRow key={f.feature} label={f.label} included={f.included} />
        ))}
      </ul>
    </Card>
  )
}

// harProfil: forsiden kan nås både som startskærm og som "tilbage til forsiden"
// fra en app man allerede bruger. Det er den samme side — men knapperne må ikke
// invitere en igangværende bruger til at starte forfra.
// indlejret: vist inde i appens skal, som har sin egen TopBar og TabBar. Uden
// den ville forsiden få to topbjælker og dække fanerne.
// visPris: falsk i pilot-skallen, hvor der ingen betaling findes og brugeren
// er med gratis. Et beløb uden noget at købe stiller noget i udsigt.
export default function Landing({ onStart, harProfil = false, indlejret = false, entitlement = null, visPris = true }) {
  const indhold = (
      <div style={{ ...s.page, paddingTop: '2rem' }}>
        <Label>Adaptiv træning</Label>
        <h1 style={s.h1}>Et program der retter sig efter hvordan det faktisk gik.</h1>
        <p style={{ ...s.body, marginBottom: '1.75rem' }}>
          Du svarer på fire spørgsmål, og så ligger der et program der passer til dit
          niveau, dine dage og dit udstyr. Du kan træne gratis. Betaler du, evaluerer
          appen din indsats efter hver uge og bygger det næste program ud fra den.
        </p>

        <Button onClick={onStart} style={{ marginBottom: '2rem' }}>
          {harProfil ? 'Tilbage til din træning' : 'Find det rigtige program'}
        </Button>

        <Label tone="muted">Forskellen</Label>
        <p style={{ ...s.body, marginBottom: '1rem' }}>
          Det er ikke antallet af programmer der adskiller de to. Det er om
          programmet lærer noget om dig undervejs.
        </p>

        <TierCard tier="free" pris="0 kr." ditNiveau={entitlement === 'free'}>
          <p style={{ ...s.body, fontSize: '0.85rem', margin: 0 }}>
            Du vælger et program, følger det, og vælger et nyt når du er færdig.
          </p>
        </TierCard>

        {/* Fremhæves kun så længe brugeren ikke selv har et niveau. Ellers ville
            salgsmarkeringen konkurrere med "dit niveau" om samme farve. */}
        <TierCard
          tier="member"
          pris={visPris ? priceLabel() : 'Medlemskab'}
          fremhaevet={!entitlement}
          ditNiveau={entitlement === 'member'}
        >
          <p style={{ ...s.body, fontSize: '0.85rem', margin: 0 }}>
            Følg → evaluér indsats → nyt program bygget på den. Det er løkken du
            betaler for.
          </p>
        </TierCard>

        {visPris && !PRICE_CONFIRMED && (
          <Meta style={{ marginBottom: '1rem', lineHeight: 1.5, textTransform: 'none', letterSpacing: '0.04em' }}>
            Prisen er vejledende og ikke endeligt fastsat.
          </Meta>
        )}

        {/* Ingen købsknap så længe der ikke findes en betaling bag den. En knap
            der fører til ingenting er værre end ingen knap. */}
        {!CHECKOUT_AVAILABLE && visPris && (
          <p style={{ ...s.body, fontSize: '0.8rem', marginBottom: '2rem' }}>
            {harProfil
              ? 'Abonnementet kan endnu ikke tegnes her. Du skifter niveau under Profil.'
              : 'Abonnementet kan endnu ikke tegnes her. Start gratis — du mister ikke noget af det du logger undervejs.'}
          </p>
        )}
        {!visPris && (
          <p style={{ ...s.body, fontSize: '0.8rem', marginBottom: '2rem' }}>
            Du er med i pilotforløbet. Alt du bruger her er gratis.
          </p>
        )}

        <Button variant="ghost" onClick={onStart}>
          {harProfil ? 'Tilbage til din træning' : 'Kom i gang gratis'}
        </Button>
      </div>
  )

  if (indlejret) return indhold

  return (
    <div style={s.wrap}>
      <TopBar title="Entropi" />
      {indhold}
    </div>
  )
}
