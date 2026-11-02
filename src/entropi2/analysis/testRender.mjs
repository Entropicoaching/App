import Analysis from './Analysis.mjs'
import { renderTree } from './testDom.mjs'

// Test boundary only. Production Analysis keeps React's ordinary return value.
export default function renderAnalysis(props) {
  return renderTree(Analysis(props))
}
