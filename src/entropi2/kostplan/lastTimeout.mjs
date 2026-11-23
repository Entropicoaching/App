// Ordre 2055: tidsgraenser for de tunge kostplan-proever (PGlite og isolerede boern).
// Malt paa en rolig maskine: 2 til 20 s pr. proeve/barn; under last (BelowNormal mod
// andre jobs) bliver de 5 til 60 gange saa langsomme og ramte de gamle 60 til 240 s.
// Graensen er kun et vagthund mod haeng, saa den skaleres, ikke proeven aendres.
export const LAST_FAKTOR = 10
export const lt = ms => ms * LAST_FAKTOR
