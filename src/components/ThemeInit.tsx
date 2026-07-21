import { useEffect } from 'react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeInit() {
  const { theme } = useTheme()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return null
}
