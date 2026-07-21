import { cn } from '../../lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'w-6 h-6 border-2',
  md: 'w-12 h-12 border-4',
  lg: 'w-16 h-16 border-4',
}

export default function Spinner({ size = 'md', label = 'Carregando...', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'rounded-full border-pink-200 dark:border-border border-t-purple-600 animate-spin',
        sizeClasses[size],
        className
      )}
    >
      <span className="sr-only">{label}</span>
    </div>
  )
}
