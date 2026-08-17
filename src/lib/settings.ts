export function getCountry(): string {
  return localStorage.getItem('tvfreak-country') ?? 'ES'
}

export function setCountry(code: string): void {
  localStorage.setItem('tvfreak-country', code)
}

export function getDefaultProviders(): number[] {
  try {
    return JSON.parse(localStorage.getItem('tvfreak-default-providers') ?? '[]')
  } catch { return [] }
}

export function setDefaultProviders(ids: number[]): void {
  localStorage.setItem('tvfreak-default-providers', JSON.stringify(ids))
}

export interface AccentColor {
  name: string
  hex: string
  rgb: string
  hover: string
}

export const ACCENT_COLORS: AccentColor[] = [
  { name: 'Purple', hex: '#BF5AF2', rgb: '191, 90, 242',  hover: '#A63FD9' },
  { name: 'Blue',   hex: '#0A84FF', rgb: '10, 132, 255',  hover: '#0071E3' },
  { name: 'Cyan',   hex: '#5AC8FA', rgb: '90, 200, 250',  hover: '#32AEE4' },
  { name: 'Green',  hex: '#30D158', rgb: '48, 209, 88',   hover: '#25A244' },
  { name: 'Yellow', hex: '#FFD60A', rgb: '255, 214, 10',  hover: '#E6BE00' },
  { name: 'Orange', hex: '#FF9F0A', rgb: '255, 159, 10',  hover: '#E68900' },
  { name: 'Pink',     hex: '#FF375F', rgb: '255, 55, 95',     hover: '#E0274B' },
  { name: 'Hot Pink', hex: '#FF0099', rgb: '255, 0, 153',    hover: '#CC0078' },
  { name: 'Gold',     hex: '#FFB300', rgb: '255, 179, 0',    hover: '#E89E00' },
  { name: 'Indigo',   hex: '#5E5CE6', rgb: '94, 92, 230',    hover: '#4644C9' },
]

export function getAccentColor(): AccentColor {
  const saved = localStorage.getItem('tvfreak-accent')
  return ACCENT_COLORS.find(c => c.hex === saved) ?? ACCENT_COLORS[0]
}

export function applyAccentColor(color: AccentColor): void {
  const r = document.documentElement
  r.style.setProperty('--color-accent', color.hex)
  r.style.setProperty('--color-accent-fill', color.hex)
  r.style.setProperty('--color-accent-hover', color.hover)
  r.style.setProperty('--color-accent-subtle', `rgba(${color.rgb}, 0.15)`)
  r.style.setProperty('--accent-rgb', color.rgb)
  localStorage.setItem('tvfreak-accent', color.hex)
}

export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EG', name: 'Egypt' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'AE', name: 'UAE' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'VE', name: 'Venezuela' },
]
