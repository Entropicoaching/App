// u8d: tal til mennesker med dansk decimalkomma. Kun til visning; gemte værdier,
// prompts til AI og tal der parses igen bevarer punktum.

// Et tal eller en tekst som "87.5" vises som "87,5". Tekst som "~85" står som den er.
export const komma = value => String(value ?? '').replace(/(\d)\.(\d)/, '$1,$2')

// Et beregnet tal med et fast antal decimaler: decimaler(1.234, 2) giver "1,23".
export const decimaler = (value, digits = 1) => value.toFixed(digits).replace('.', ',')

// Et inputfelts tekst til visning: "87." vises "87,"; feltets state beholder punktum.
export const feltKomma = value => String(value ?? '').replace('.', ',')

// Skærmens tekst tilbage til feltets state: dansk komma bliver punktum.
export const feltPunktum = value => String(value ?? '').replace(',', '.')
