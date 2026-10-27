import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export function previewConfig(root, reactPlugin) {
  const source = name => resolve(root, 'src', name)
  const constants = new Map([
    [source('dashboard/coachActions.mjs'), 'COACH_ACTIONS_ENABLED'],
    [source('dashboard/videoQueueFilter.mjs'), 'VIDEO_QUEUE_FILTER_ENABLED'],
    [source('vcForenkl4.mjs'), 'DEFAULT_VIDEOCOACH_FORENKL4'],
  ].map(([path, name]) => [path.replaceAll('\\','/'), name]))
  return { root, configFile: false, envFile: false, envDir: false,
    mode: 'e2e', publicDir: false,
    resolve: { alias: [{ find: /^.*[/\\]supabase(?:\.js)?$/, replacement: source('fridayPreviewAdapter.mjs') }] },
    plugins: [{ name: 'friday-preview-only', enforce: 'pre',
      transform(code, id) {
        const cleanId = id.replaceAll('\\','/').split('?')[0]
        if (cleanId === source('athlete/beskederOgVaegt.jsx').replaceAll('\\','/')) {
          const anchor = "from './VideoFeedbackPlayback.jsx'"
          if (code.split(anchor).length !== 2) throw new Error('Previewfeedback ændret')
          return { code: code.replace(anchor, "from '../fridayPreviewMarkersReact.mjs'"), map: null }
        }
        if (cleanId === source('dashboard/VideoReviewModal.jsx').replaceAll('\\','/')) {
          const anchor = 'onClick={e => e.stopPropagation()}>'
          if (code.split(anchor).length !== 2 || code.includes('VideoFeedbackPlayback as FridayMarkers'))
            throw new Error('Previewmodal ændret')
          const eol = code.includes('\r\n') ? '\r\n' : '\n'
          return { code: `import { VideoFeedbackPlayback as FridayMarkers } from '../fridayPreviewMarkersReact.mjs'${eol}` +
            code.replace(anchor, anchor + `${eol}<FridayMarkers athleteId={selectedAthlete?.id} analysisId={analysis.id} />`), map: null }
        }
        const name = constants.get(cleanId)
        if (!name) return null
        const pattern = new RegExp(`(export const ${name} = )false\\b`)
        if (!pattern.test(code)) throw new Error(`Previewflag ændret: ${name}`)
        return { code: code.replace(pattern, '$1true'), map: null }
      } }, reactPlugin()],
    build: { outDir: resolve(root, 'preview-friday-dist'), emptyOutDir: false,
      rollupOptions: { input: resolve(root, 'scripts/friday-preview.html') } } }
}

export async function main(args = [], load = async () => { const [vite, react] = await Promise.all([import('vite'), import('@vitejs/plugin-react')]); return { build: vite.build, reactPlugin: react.default } }, root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  if (args.length === 0) return 'OFF: node scripts/friday-preview.mjs --build-preview'
  if (args.length !== 1 || args[0] !== '--build-preview') throw new Error('Brug kun --build-preview')
  const { build, reactPlugin } = await load()
  await build(previewConfig(root, reactPlugin))
  return 'PASS: syntetisk preview bygget i preview-friday-dist. Ingen server startet.'
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2)).then(console.log).catch(error => { console.error(error.message); process.exitCode = 1 })
