import { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import BottomNav from './ui/BottomNav'

const NAV_VISIBLE_PATHS = ['/home', '/profile']

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const showBottomNav = NAV_VISIBLE_PATHS.includes(location.pathname)

  return (
    <div className="min-h-screen">
      {children}
      {showBottomNav && <BottomNav />}
    </div>
  )
}
