import { cn } from '../../lib/utils'

export default function AmbientGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute rounded-full bg-accent blur-3xl opacity-[0.15]', className)}
    />
  )
}
