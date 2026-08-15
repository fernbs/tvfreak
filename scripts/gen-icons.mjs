import { Resvg } from '@resvg/resvg-js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')

// Clean thunderbolt — white bolt on indigo square background
const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#6366F1"/>
  <path d="M 63 6 L 35 52 L 54 52 L 37 94 L 65 48 L 46 48 Z" fill="white"/>
</svg>`

// Favicon — bolt only, no background (transparent)
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 63 6 L 35 52 L 54 52 L 37 94 L 65 48 L 46 48 Z" fill="#6366F1"/>
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
