import { renderToStaticMarkup } from 'react-dom/server'

// Ordre 1692: prøvehjælp. Atletens tal ligger nu i rækken i Dine atleter (en komponent), så elementtræet viser dem ikke;
// denne hjælper renderer til markup og returnerer den synlige tekst.
const entities = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#x27;': "'" }
export const htmlTekst = element => renderToStaticMarkup(element).replace(/<[^>]*>/g, ' ')
  .replace(/&(?:lt|gt|amp|quot|#x27);/g, e => entities[e]).replace(/\s+/g, ' ')
