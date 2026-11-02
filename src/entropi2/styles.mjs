// CSS indlæses først i browseren, så Node-prøver der importerer appens filer ikke rammer .css.
let loaded = false
export function loadEntropi2Styles() {
  if (loaded || typeof document === 'undefined') return
  loaded = true
  void import('./nutrition/nutrition.css')
  void import('./entropi2.css')
}
