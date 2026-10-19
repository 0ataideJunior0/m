/** Dias da semana como o banco guarda: 1 = segunda … 7 = domingo. */
export const WEEKDAY_NAMES = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']
export const WEEKDAY_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/** Dia da semana de hoje (horário local) no formato do banco. */
export const todayWeekday = (now = new Date()) => ((now.getDay() + 6) % 7) + 1
