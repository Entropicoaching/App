export function normalizeAthleteLoginEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function athleteAuthErrorMessage(error, mode = 'login') {
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : ''
  if (message.includes('invalid login credentials')) return 'Email eller adgangskode er forkert.'
  if (message.includes('email not confirmed')) return 'Bekræft din email via linket, før du logger ind.'
  if (message.includes('user already registered')) return 'Der findes allerede en konto med denne email. Log ind i stedet.'
  if (message.includes('password should be at least')) return 'Adgangskoden er for kort.'
  if (message.includes('signup is disabled')) return 'Oprettelse af konto er midlertidigt lukket. Kontakt din coach.'
  if (message.includes('rate limit')) return 'Der er sket for mange forsøg på kort tid. Vent lidt og prøv igen.'
  return mode === 'signup'
    ? 'Kontoen kunne ikke oprettes. Tjek oplysningerne eller kontakt din coach.'
    : 'Du kunne ikke logge ind. Tjek oplysningerne og prøv igen.'
}
