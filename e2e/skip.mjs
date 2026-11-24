// Ordre 2069: begrundet test.skip for e2e-specs, der prøver Entropi 1-skærme, som Entropi 2 ikke tegner.
// Specen står uændret; den kører igen med E2E_KOER_SKIPPEDE=1. Kald: if (!skipSpec(navn, aarsag, nyere)) main()
export function skipSpec(navn, aarsag, nyere) {
  if (process.env.E2E_KOER_SKIPPEDE) return false
  console.log(`SKIP ${navn}: ${aarsag} Dækkes nu af: ${nyere}. Kør igen med E2E_KOER_SKIPPEDE=1.`)
  return true
}
