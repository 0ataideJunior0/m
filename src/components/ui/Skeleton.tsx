import { cn } from '../../lib/utils'

interface SkeletonProps {
  variant?: 'block' | 'shimmer'
  className?: string
}

export default function Skeleton({ variant = 'block', className }: SkeletonProps) {
  if (variant === 'shimmer') {
    return <div aria-hidden className={cn('skeleton ui-shimmer rounded', className)} />
  }
  return <div aria-hidden className={cn('animate-pulse bg-purple-200 dark:bg-border rounded', className)} />
}
