/**
 * Tema gelap/terang — class `dark` di <html>, persist localStorage,
 * default ikut preferensi sistem.
 */
import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const LS_KEY = 'amdalnet-theme'

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      /* localStorage tidak tersedia */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    apply(theme)
    try {
      localStorage.setItem(LS_KEY, theme)
    } catch {
      /* abaikan */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
