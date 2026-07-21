import { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode
  error?: boolean
}

export default function Input({ icon, error, className, ...rest }: InputProps) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-text-muted">
          {icon}
        </span>
      )}
      <input
        aria-invalid={error || undefined}
        className={cn(
          'w-full px-4 py-3 border rounded-lg outline-none transition',
          'focus:ring-2 focus:ring-purple-500 focus:border-transparent',
          'dark:bg-surface dark:text-text',
          icon ? 'pl-10' : '',
          error ? 'border-red-400' : 'border-gray-300 dark:border-border',
          className
        )}
        {...rest}
      />
    </div>
  )
}
