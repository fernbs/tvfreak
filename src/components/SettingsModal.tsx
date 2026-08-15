import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import { getCountry, setCountry, COUNTRIES } from '../lib/settings'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const [country, setLocalCountry] = useState(getCountry)

  function handleCountryChange(code: string) {
    setLocalCountry(code)
    setCountry(code)
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
        className="fixed bottom-0 left-0 right-0 bg-[#141414] rounded-t-2xl z-50 border-t border-white/8"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
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
        <div className="px-5 pb-4 space-y-4">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider font-medium mb-2">Your country</p>
            <p className="text-xs text-white/35 mb-3">Used to show streaming platforms available in your region.</p>
            <div className="relative">
              <select
                value={country}
                onChange={e => handleCountryChange(e.target.value)}
                style={{ fontSize: 16 }}
                className="w-full bg-[#1E1E1E] border border-white/8 rounded-xl px-4 pr-10 py-3 text-sm text-white outline-none appearance-none"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-[#1E1E1E]">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
