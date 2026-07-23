import { cn } from '../../lib/utils'

interface ChoiceOption {
  value: string
  label: string
}

interface ChoiceGroupProps {
  label: string
  name: string
  options: ChoiceOption[]
  value: string | null
  onChange: (value: string) => void
  error?: string
}

export default function ChoiceGroup({ label, name, options, value, onChange, error }: ChoiceGroupProps) {
  return (
    <div>
      <span className="block text-sm font-medium text-gray-700 dark:text-text-muted mb-2">{label}</span>
      <div role="radiogroup" aria-label={label} className={cn('grid gap-3', options.length <= 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              name={name}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-2xl px-4 py-4 text-center font-medium transition transform active:scale-95',
                'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
                selected
                  ? 'brand-gradient shadow-md'
                  : 'bg-white dark:bg-surface border border-gray-300 dark:border-border text-gray-900 dark:text-text hover:bg-gray-50 dark:hover:bg-white/5'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
