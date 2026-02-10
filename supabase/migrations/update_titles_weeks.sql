-- Atualiza títulos para padrão: Semana X • Dia-da-semana • <subtítulo opcional>
-- Mapeamento do dia da semana pelo day_number
update public.workouts w
set title = concat(
  'Semana ',
  ((w.day_number - 1) / 7)::int + 1,
  ' • ',
  case ((w.day_number - 1) % 7) + 1
    when 1 then 'Segunda-feira'
    when 2 then 'Terça-feira'
    when 3 then 'Quarta-feira'
    when 4 then 'Quinta-feira'
    when 5 then 'Sexta-feira'
    when 6 then 'Sábado'
    when 7 then 'Domingo'
  end,
  coalesce(
    case
      -- extrai subtítulo após dois pontos (ex.: 'T-D: Ombro e Tríceps')
      when position(':' in w.title) > 0 then
        concat(' • ', btrim(substring(w.title from position(':' in w.title) + 1)))
      -- subtítulos 'Treino N - <nome>'
      when w.title ~* '^\\s*Treino\\s+\\d+\\s*-\\s*' then
        concat(' • ', regexp_replace(w.title, '^\\s*Treino\\s+\\d+\\s*-\\s*', '', 'i'))
      else null
    end,
    ''
  )
)
where true;

