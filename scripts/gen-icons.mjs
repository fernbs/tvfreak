import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// Bold thunderbolt — wide white bolt on indigo gradient square
const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#4338CA"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#bg)"/>
  <path d="M 61 5 L 78 48 L 56 48 L 39 95 L 22 52 L 44 52 Z" fill="white"/>
</svg>`

// Favicon — bolt on indigo gradient square
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#4338CA"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#bg)"/>
  <path d="M 61 5 L 78 48 L 56 48 L 39 95 L 22 52 L 44 52 Z" fill="white"/>
</svg>`

function svgToPng(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'transparent',
  })
  return resvg.render().asPng()
}

writeFileSync(join(publicDir, 'icon-192.png'), svgToPng(appIconSvg, 192))
console.log('✓ icon-192.png')

writeFileSync(join(publicDir, 'icon-512.png'), svgToPng(appIconSvg, 512))
console.log('✓ icon-512.png')

writeFileSync(join(publicDir, 'apple-touch-icon.png'), svgToPng(appIconSvg, 180))
console.log('✓ apple-touch-icon.png')

writeFileSync(join(publicDir, 'favicon.svg'), faviconSvg)
console.log('✓ favicon.svg')

console.log('Done.')
