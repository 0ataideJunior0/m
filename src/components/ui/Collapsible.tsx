import { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export default function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group mt-4 rounded-xl border border-gray-200 dark:border-border bg-gray-50/60 dark:bg-white/5">
      <summary className="cursor-pointer select-none list-none marker:hidden [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 px-4 py-3 font-medium text-gray-800 dark:text-text">
        <span>{title}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}
