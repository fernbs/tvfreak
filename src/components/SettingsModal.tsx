import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { getCountry, setCountry, COUNTRIES, getDefaultProviders, setDefaultProviders } from '../lib/settings'
import { getStreamingProviders, IMG_BASE } from '../lib/tmdb'
import type { WatchProvider } from '../types'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const [country, setLocalCountry] = useState(getCountry)
  const [availableProviders, setAvailableProviders] = useState<WatchProvider[]>([])
  const [defaultProviderIds, setLocalDefaultProviders] = useState<number[]>(getDefaultProviders)

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
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.9 }}
        className="fixed bottom-0 left-0 right-0 bg-[#0D1926] rounded-t-2xl z-50 border-t border-white/8"
        style={{ paddingBottom: '1.5rem' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-5">
          <h2 className="text-base font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-4 space-y-5">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">Your country</p>
            <p className="text-xs text-white/35 mb-3">Used to show streaming platforms available in your region.</p>
            <div className="relative">
              <select
                value={country}
                onChange={e => handleCountryChange(e.target.value)}
                style={{ fontSize: 16 }}
                className="w-full bg-[#152337] border border-white/8 rounded-xl px-4 pr-10 py-3 text-sm text-white outline-none appearance-none"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-[#152337]">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            </div>
          </div>

          {availableProviders.length > 0 && (
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-1">Default platforms in search</p>
              <p className="text-xs text-white/35 mb-3">Selected platforms will be pre-applied every time you open Search. Leave all off to show everything.</p>
              <div className="flex flex-wrap gap-2">
                {availableProviders.map(p => {
                  const isSelected = defaultProviderIds.includes(p.provider_id)
                  return (
                    <button
                      key={p.provider_id}
                      onClick={() => toggleDefaultProvider(p.provider_id)}
                      title={p.provider_name}
                      className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-[#3B82F6]/20 border-[#3B82F6]/60 text-white'
                          : 'bg-white/5 border-white/8 text-white/40 active:bg-white/10'
                      }`}
                    >
                      <img src={`${IMG_BASE}/w45${p.logo_path}`} alt={p.provider_name} className="w-5 h-5 rounded-sm object-cover shrink-0" />
                      <span className="text-[11px] font-medium whitespace-nowrap">{p.provider_name}</span>
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
