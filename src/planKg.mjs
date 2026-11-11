// Coachens planvægt til visning: dansk komma (87,5). Tekst som "~85" vises som den er.
export const planKg = value => String(value).replace(/(\d)\.(\d)/, '$1,$2')
