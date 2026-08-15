import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'

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
