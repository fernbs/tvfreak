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
  { name: 'Blue',     hex: '#0A84FF', rgb: '10, 132, 255',  hover: '#0071E3' },
  { name: 'Indigo',   hex: '#5E5CE6', rgb: '94, 92, 230',   hover: '#4644C9' },
  { name: 'Hot Pink', hex: '#FF0099', rgb: '255, 0, 153',   hover: '#CC0078' },
  { name: 'Red',      hex: '#FF3030', rgb: '255, 48, 48',   hover: '#E01010' },
  { name: 'Orange',   hex: '#FF6600', rgb: '255, 102, 0',   hover: '#E05800' },
  { name: 'Gold',     hex: '#CC8800', rgb: '204, 136, 0',   hover: '#AA7000' },
  { name: 'Yellow',   hex: '#FFD60A', rgb: '255, 214, 10',  hover: '#E6BE00' },
  { name: 'Green',    hex: '#00C840', rgb: '0, 200, 64',    hover: '#00A832' },
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
