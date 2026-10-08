import { HeatmapWeek, HeatmapDay } from '../../utils/activity'

const MONTHS_LONG = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DAY_LABELS: Record<number, string> = { 0: 'Seg', 2: 'Qua', 4: 'Sex' }

const LEVEL_CLASSES = ['bg-surface-hover', 'bg-accent/50', 'bg-accent-text']

const describeDay = (day: HeatmapDay) => {
  const [, m, d] = day.date.split('-').map(Number)
  const what = day.count === 0 ? 'sem treino' : day.count === 1 ? '1 treino' : `${day.count} treinos`
  return `${d} ${MONTHS_LONG[m - 1]} · ${what}`
}

export default function ActivityHeatmap({ weeks }: { weeks: HeatmapWeek[] }) {
  const total = weeks.reduce((sum, w) => sum + w.days.reduce((s, d) => s + d.count, 0), 0)

  return (
    <section
      aria-label="Frequência de treinos"
      className="bg-surface border border-border-card rounded-3xl shadow-sm p-5"
    >
      <h2 className="text-xl font-extrabold tracking-tight text-text-strong">
        Sua <span className="font-accent">constância</span>
      </h2>
      <p className="text-sm text-text-muted mt-1 mb-4">
        {total} {total === 1 ? 'treino' : 'treinos'} nas últimas {weeks.length} semanas
      </p>

      <div className="overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={`Mapa de frequência: ${total} treinos nas últimas ${weeks.length} semanas`}
          className="flex gap-1.5 w-max"
        >
          <div aria-hidden="true" className="w-6 shrink-0 pt-[15px] flex flex-col gap-[3px]">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="h-3 text-[9px] leading-3 text-text-muted">
                {DAY_LABELS[i] ?? ''}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {weeks.map((week) => (
              <div key={week.days[0].date} className="w-3 flex flex-col gap-[3px]">
                <span aria-hidden="true" className="h-3 mb-[3px] text-[9px] leading-3 text-text-muted whitespace-nowrap">
                  {week.label}
                </span>
                {week.days.map((day) => (
                  <span
                    key={day.date}
                    title={day.future ? undefined : describeDay(day)}
                    className={[
                      'block w-3 h-3 rounded-[3px]',
                      day.future ? 'bg-transparent' : LEVEL_CLASSES[Math.min(day.count, 2)],
                      day.isToday ? 'ring-[1.5px] ring-text-strong' : '',
                    ].join(' ')}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="flex items-center justify-end gap-1 mt-3">
        <span className="text-[11px] text-text-muted mr-0.5">Menos</span>
        {LEVEL_CLASSES.map((cls) => (
          <span key={cls} className={`block w-3 h-3 rounded-[3px] ${cls}`} />
        ))}
        <span className="text-[11px] text-text-muted ml-0.5">Mais</span>
      </div>
    </section>
  )
}
