import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { getCountry, setCountry, COUNTRIES, getDefaultProviders, setDefaultProviders, ACCENT_COLORS, getAccentColor, applyAccentColor } from '../lib/settings'
import { getStreamingProviders, IMG_BASE } from '../lib/tmdb'
import type { WatchProvider } from '../types'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const [country, setLocalCountry] = useState(getCountry)
  const [availableProviders, setAvailableProviders] = useState<WatchProvider[]>([])
  const [defaultProviderIds, setLocalDefaultProviders] = useState<number[]>(getDefaultProviders)
  const [accentHex, setAccentHex] = useState(() => getAccentColor().hex)

  useEffect(() => {
    getStreamingProviders(country).then(setAvailableProviders)
  }, [country])

  function handleCountryChange(code: string) {
    setLocalCountry(code)
    setCountry(code)
  }

  function toggleDefaultProvider(id: number) {
    const next = defaultProviderIds.includes(id)
      ? defaultProviderIds.filter(p => p !== id)
      : [...defaultProviderIds, id]
    setLocalDefaultProviders(next)
    setDefaultProviders(next)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.9 }}
        className="fixed bottom-0 left-0 right-0 bg-[#111111] rounded-t-3xl z-50 border-t border-white/10"
        style={{ paddingBottom: '1.5rem' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/12" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-5">
          <h2 className="text-base font-semibold text-[#F5F5F7]">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#1C1C1E] border border-white/8 text-[#8E8E93] hover:text-[#F5F5F7] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-4 space-y-5">

          {/* Accent colour */}
          <div>
            <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-3">Accent colour</p>
            <div className="flex gap-3 flex-wrap">
              {ACCENT_COLORS.map(color => (
                <button
                  key={color.hex}
                  onClick={() => {
                    applyAccentColor(color)
                    setAccentHex(color.hex)
                  }}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    backgroundColor: color.hex,
                    boxShadow: accentHex === color.hex
                      ? `0 0 0 2px #111111, 0 0 0 4px ${color.hex}`
                      : 'none',
                    transform: accentHex === color.hex ? 'scale(1.15)' : 'scale(1)',
                  }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-1.5">Your country</p>
            <p className="text-xs text-[#8E8E93] mb-3">Used to show streaming platforms available in your region.</p>
            <div className="relative">
              <select
                value={country}
                onChange={e => handleCountryChange(e.target.value)}
                style={{ fontSize: 16 }}
                className="w-full bg-[#1C1C1E] border border-white/8 rounded-2xl px-4 pr-10 py-3 text-sm text-[#F5F5F7] outline-none appearance-none focus:border-white/20 transition-colors"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-[#1C1C1E]">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#48484A] pointer-events-none" />
            </div>
          </div>

          {availableProviders.length > 0 && (
            <div>
              <p className="text-[10px] text-[#48484A] uppercase tracking-widest font-semibold mb-1">Default platforms in search</p>
              <p className="text-xs text-[#8E8E93] mb-3">Selected platforms will be pre-applied every time you open Search. Leave all off to show everything.</p>
              <div className="flex flex-wrap gap-2">
                {availableProviders.map(p => {
                  const isSelected = defaultProviderIds.includes(p.provider_id)
                  return (
                    <button
                      key={p.provider_id}
                      onClick={() => toggleDefaultProvider(p.provider_id)}
                      title={p.provider_name}
                      className={`w-9 h-9 rounded-xl overflow-hidden border-2 transition-all ${
                        isSelected ? 'border-[var(--color-accent)]' : 'border-transparent opacity-40'
                      }`}
                    >
                      <img src={`${IMG_BASE}/original${p.logo_path}`} alt={p.provider_name} className="w-full h-full object-cover" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
