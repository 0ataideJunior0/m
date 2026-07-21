import { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg'
}

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export default function Card({ padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn('bg-white dark:bg-surface rounded-2xl shadow-lg', paddingClasses[padding], className)}
      {...rest}
    >
      {children}
    </div>
  )
}
