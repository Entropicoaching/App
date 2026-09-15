import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Unik id pr. build. Bages ind i bundlen (__BUILD_ID__) og skrives til
// dist/version.json, så klientens versions-tjek kan opdage en ny deploy.
const buildId = new Date().toISOString().replace(/[^\dT]/g, '').slice(0, 15)

// ORDRE 233 · commit 1 — hovedbundtet (index.js) og skærmens egen chunk
// (Dashboard/AthleteView) hentes i dag i SERIE: chunken venter på at hoved-
// bundtets modulgraf er kørt, fordi den først opdages via App.jsx's lazy
// import(). Se docs/RAPPORT-231.md punkt 2. Med 201's rollehukommelse
// (src/roleCache.js) ved browseren allerede ved første byte hvilken rolle
// der sandsynligvis logger ind — dette plugin lægger et <link
// rel="modulepreload"> for netop den rolles chunk ind i index.html, FØR
// hovedbundtet kører, så de to hentes side om side i stedet for i kø.
//
// Chunk-filnavnene (med deres byggetids-hash) kendes først når Rollup har
// renderet chunks — derfor sker dette i transformIndexHtml med order:
// 'post' (ctx.bundle er kun sat her, under build, ikke under `vite dev`).
// Selve udvælgelseslogikken (guessRoleFromStorage/preloadHrefForRole)
// hentes fra src/roleCache.js og bages ind ORD FOR ORD (kun 'export '
// fjernet) — samme kode som roleCache.test.js enhedstester, ingen separat
// kopi der kan gå i utakt. Forkert gæt eller intet gæt: ingen fejl, ingen
// preload — adfærd som i dag (se roleCache.js's kommentarer for detaljen).
function roleGuessPreloadPlugin() {
  return {
    name: 'entropi-role-guess-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === 'chunk')
        const dashboardChunk = chunks.find((c) => c.name === 'Dashboard')
        const athleteChunk = chunks.find((c) => c.name === 'AthleteView')
        // Uventet buildform (fx en fremtidig omdøbning af skærmene) — spring
        // forudindlæsningen over frem for at gætte forkert filnavn.
        if (!dashboardChunk || !athleteChunk) return html

        const chunkHrefs = {
          coach: `/${dashboardChunk.fileName}`,
          athlete: `/${athleteChunk.fileName}`,
        }
        // Kommentar-linjerne strippes af to grunde: (1) det holder scriptet
        // det er, "lille" og hurtigt at parse FØR hovedbundtet, (2) de er
        // danske (æ/ø/å, multi-byte UTF-8) — dumpet råt ville skubbe
        // <meta charset> ud over HTML5's 1024-byte grænse for hvor tidligt
        // den skal findes, se nedenfor.
        const roleCacheSource = readFileSync(join(__dirname, 'src/roleCache.js'), 'utf-8')
          .replace(/^export /gm, '')
          .split('\n')
          .filter((line) => !/^\s*\/\//.test(line))
          .join('\n')

        // Pakket i en IIFE, så roleCache.js's navne (roleCacheKey m.fl.) ikke
        // lækker til det globale scope — dette er et almindeligt, ikke-module
        // inline script, og skal derfor selv rydde op efter sig.
        const inlineScript =
          `(function(){\n${roleCacheSource}\n` +
          `try {\n` +
          `  var __role = guessRoleFromStorage(window.localStorage);\n` +
          `  var __href = preloadHrefForRole(__role, ${JSON.stringify(chunkHrefs)});\n` +
          `  if (__href) {\n` +
          `    var __link = document.createElement('link');\n` +
          `    __link.rel = 'modulepreload';\n` +
          `    __link.href = __href;\n` +
          `    document.head.appendChild(__link);\n` +
          `  }\n` +
          `} catch (e) { /* ingen forudindlæsning ved fejl, adfærd som i dag */ }\n` +
          `})();`

        // Indsat lige EFTER <meta charset>, ikke via injectTo 'head-prepend'
        // (som ville lægge scriptet FØR charset-deklarationen — se ovenfor)
        // og heller ikke i slutningen af <head> (for sent: skal ligge før
        // hovedbundtets <script type="module">, som Vite selv placerer i
        // <head>, for at forudindlæsningen reelt konkurrerer parallelt med
        // den, ikke bagefter).
        const charsetTag = '<meta charset="UTF-8" />'
        if (!html.includes(charsetTag)) return html
        const patchedHtml = html.replace(charsetTag, `${charsetTag}\n    <script>${inlineScript}</script>`)
        return patchedHtml
      },
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    roleGuessPreloadPlugin(),
    {
      name: 'entropi-build-version',
      apply: 'build',
      writeBundle(options) {
        const dir = options.dir || 'dist'
        writeFileSync(join(dir, 'version.json'), JSON.stringify({ buildId }))
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  base: '/',
})
