import { Resvg } from '@resvg/resvg-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// TV + lightning bolt icon SVG
// Coordinates in 100x100 viewBox
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- Dark app icon background -->
  <rect width="100" height="100" rx="22" fill="#111827"/>

  <!-- TV body (indigo) -->
  <rect x="8" y="14" width="84" height="58" rx="8" fill="#6366F1"/>

  <!-- TV screen (dark) -->
  <rect x="15" y="21" width="70" height="43" rx="5" fill="#0f172a"/>

  <!-- TV stand neck -->
  <rect x="43" y="72" width="14" height="7" rx="2" fill="#4F46E5"/>

  <!-- TV stand base -->
  <rect x="32" y="79" width="36" height="6" rx="3" fill="#4F46E5"/>

  <!-- Lightning bolt (amber, inside screen) -->
  <path d="M 57 23 L 38 47 L 52 47 L 43 65 L 62 41 L 48 41 Z" fill="#FBBF24"/>
</svg>`

// Favicon SVG — same shape but no app background, so it looks good small
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- TV body (indigo) -->
  <rect x="0" y="0" width="100" height="70" rx="10" fill="#6366F1"/>

  <!-- TV screen (dark) -->
  <rect x="8" y="8" width="84" height="52" rx="6" fill="#0f172a"/>

  <!-- TV stand neck -->
  <rect x="42" y="70" width="16" height="9" rx="2" fill="#4F46E5"/>

  <!-- TV stand base -->
  <rect x="28" y="79" width="44" height="8" rx="4" fill="#4F46E5"/>

  <!-- Lightning bolt (amber) -->
  <path d="M 58 11 L 37 40 L 53 40 L 42 62 L 63 33 L 47 33 Z" fill="#FBBF24"/>
</svg>`

function svgToPng(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'transparent',
  })
  return resvg.render().asPng()
}

// Generate icon-192.png
writeFileSync(join(publicDir, 'icon-192.png'), svgToPng(iconSvg, 192))
console.log('✓ icon-192.png')

// Generate icon-512.png
writeFileSync(join(publicDir, 'icon-512.png'), svgToPng(iconSvg, 512))
console.log('✓ icon-512.png')

// Generate apple-touch-icon.png (180x180 standard size)
writeFileSync(join(publicDir, 'apple-touch-icon.png'), svgToPng(iconSvg, 180))
console.log('✓ apple-touch-icon.png')

// Update favicon.svg
writeFileSync(join(publicDir, 'favicon.svg'), faviconSvg)
console.log('✓ favicon.svg')

console.log('All icons generated.')
