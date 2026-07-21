import { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../../lib/utils'

interface PageHeaderProps {
  title: string
  onBack?: () => void
  right?: ReactNode
  className?: string
}

export default function PageHeader({ title, onBack, right, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center mb-4', className)}>
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="mr-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <ArrowLeft className="w-6 h-6 text-gray-800 dark:text-text" />
        </button>
      )}
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-text flex-1">{title}</h1>
      {right}
    </div>
  )
}
