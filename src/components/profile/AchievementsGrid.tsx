import { Sparkles, Trophy, Medal, CalendarCheck, Sunrise, Flame, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Achievement, AchievementIcon } from '../../utils/activity'

const ICONS: Record<AchievementIcon, LucideIcon> = {
  sparkles: Sparkles,
  trophy: Trophy,
  medal: Medal,
  calendar: CalendarCheck,
  sunrise: Sunrise,
  flame: Flame,
}

export default function AchievementsGrid({ achievements }: { achievements: Achievement[] }) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length

  return (
    <section aria-label="Conquistas" className="bg-surface border border-border-card rounded-3xl shadow-sm p-5">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-xl font-extrabold tracking-tight text-text-strong">
          Suas <span className="font-accent">conquistas</span>
        </h2>
        <span className="text-sm text-text-muted">
          {unlockedCount} de {achievements.length}
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-x-2.5 gap-y-5">
        {achievements.map((a) => {
          const Icon = a.unlocked ? ICONS[a.icon] : Lock
          return (
            <li key={a.id} className="flex flex-col items-center gap-2 text-center">
              <span
                className={
                  a.unlocked
                    ? 'w-14 h-14 rounded-full brand-gradient flex items-center justify-center shadow-md'
                    : 'w-14 h-14 rounded-full bg-surface-hover/60 border-[1.5px] border-dashed border-border text-text-muted flex items-center justify-center'
                }
              >
                <Icon className="w-6 h-6" aria-hidden="true" />
              </span>
              <span className={`text-xs leading-tight font-extrabold ${a.unlocked ? 'text-text-strong' : 'text-text-muted'}`}>
                {a.title}
              </span>
              <span className="text-[11px] text-text-muted">{a.hint}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
