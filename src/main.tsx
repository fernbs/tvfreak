import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { getAccentColor, applyAccentColor } from './lib/settings'

applyAccentColor(getAccentColor())

const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true

const update = () => {
  const vvh = window.visualViewport?.height ?? window.innerHeight
  // In iOS standalone portrait, visualViewport.height = screen.height - status_bar.
  // fixed;bottom:0 lands at the viewport bottom (physical y=793), not the screen
  // bottom (physical y=852). Bleeding by that gap fills the space with nav background.
  const isLandscape = window.matchMedia('(orientation: landscape)').matches
  const bleed = isStandalone && !isLandscape ? Math.max(0, screen.height - vvh) : 0
  // In standalone portrait, set --vvh to the full screen height so the in-flow
  // nav's bleed area renders in the safe zone below the visual viewport.
  const cssVvh = isStandalone && !isLandscape ? screen.height : vvh
  document.documentElement.style.setProperty('--vvh', `${cssVvh}px`)
  document.documentElement.style.setProperty('--nav-bleed', `${bleed}px`)
}

update()
window.visualViewport?.addEventListener('resize', update)
window.addEventListener('orientationchange', () => setTimeout(update, 100))

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: '#1C1C1E',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#F5F5F7',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        },
      }}
    />
  </StrictMode>,
)
