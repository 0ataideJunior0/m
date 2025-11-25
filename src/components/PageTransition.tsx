import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

export default function PageTransition() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 400)
    return () => clearTimeout(t)
  }, [location.pathname])

  return (
    <div
      aria-hidden
      className={`fixed inset-0 pointer-events-none transition-opacity duration-400 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ zIndex: 9999 }}
    >
      <div className={`w-full h-full bg-white/70 backdrop-blur-sm ${visible ? 'ui-fade-in' : ''}`}></div>
    </div>
  )
}

