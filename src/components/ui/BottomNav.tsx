import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home as HomeIcon, Dumbbell, User } from 'lucide-react'
import { cn } from '../../lib/utils'

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (location.pathname !== '/home' || location.hash !== '#treinos') return
    attemptsRef.current = 0
    const scrollToTreinos = () => {
      const el = document.getElementById('treinos')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
      attemptsRef.current += 1
      if (attemptsRef.current < 60) requestAnimationFrame(scrollToTreinos)
    }
    requestAnimationFrame(scrollToTreinos)
  }, [location.pathname, location.hash])

  const isInicio = location.pathname === '/home' && location.hash !== '#treinos'
  const isTreinos = location.pathname === '/home' && location.hash === '#treinos'
  const isPerfil = location.pathname === '/profile'

  const items = [
    { label: 'Início', icon: HomeIcon, active: isInicio, onClick: () => navigate('/home') },
    {
      label: 'Treinos',
      icon: Dumbbell,
      active: isTreinos,
      onClick: () => {
        if (location.pathname === '/home') {
          document.getElementById('treinos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          navigate('/home#treinos', { replace: true })
        } else {
          navigate('/home#treinos')
        }
      },
    },
    { label: 'Perfil', icon: User, active: isPerfil, onClick: () => navigate('/profile') },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-surface border-t border-gray-200 dark:border-border flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      {items.map(({ label, icon: Icon, active, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex-1 flex flex-col items-center justify-center py-2 text-xs transition',
            active ? 'text-purple-600 dark:text-pink-400 font-medium' : 'text-gray-500 dark:text-text-muted'
          )}
        >
          <Icon className="w-6 h-6 mb-0.5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
