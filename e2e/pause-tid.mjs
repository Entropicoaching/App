// Laeser pausens tid fra footeren (visTid: "45s" under et minut, ellers "1:29").
export const PAUSE_TID = '[data-testid="rest-pause-open"] > span:nth-of-type(2)'
export const tidTilSek = (t) => {
  const m = /^(\d+):(\d{2})$/.exec(t.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : parseInt(t, 10)
}
export const laesPauseSek = async (page) => tidTilSek(await page.locator(PAUSE_TID).first().textContent())
