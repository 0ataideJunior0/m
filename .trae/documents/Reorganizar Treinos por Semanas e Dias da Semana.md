## Objetivo
Substituir títulos "Treino N" pelos dias da semana e reorganizar os 30 dias em semanas (Segunda–Domingo), preservando a ordem e conteúdo.

## Mapeamento
- Treino 1 → Segunda-feira
- Treino 2 → Terça-feira
- Treino 3 → Quarta-feira
- Treino 4 → Quinta-feira
- Treino 5 → Sexta-feira
- Treino 6 → Sábado
- Treino 7 → Domingo
- Semana = ceil(day_number / 7), DiaDaSemana = ((day_number - 1) % 7) + 1

## Migração (Supabase)
1) Atualizar títulos na tabela `workouts`:
- `title = CONCAT('Semana ', ceil(day_number/7), ' • ', dia_semana_pt, coalesce(' • '||subtitulo_antigo, ''))`
- `dia_semana_pt` via CASE para 1..7: Segunda-feira ... Domingo
- Preservar qualquer subtítulo existente após ":" (ex.: "Ombro e Tríceps")
- Não alterar `exercises`, `video_url` ou `day_number`

2) Garantias:
- Ordem mantida: `day_number` continua determinando sequência
- Índices e constraints inalterados

## UI/Aplicação
1) WorkoutDay:
- Header exibir: `Semana X • <Dia da Semana>`
- Fallback: se `title` já traz o padrão, apenas renderizar direto

2) Home:
- "Treino de Hoje": exibir `Dia {day_number}: Semana X • <Dia>` (ou somente `<Dia>`)

3) Progress:
- Timeline: agrupar visualmente por semanas (4 blocos), com 7 itens cada identificados por dia da semana
- Botão navega para `/workout/:day`

## Persistência/Compatibilidade
- Nenhuma alteração de schema além dos títulos; APIs atuais continuam
- Mantém vídeos, exercícios e sincronização já existentes

## Testes
- Verificar 30 dias com nomes corretos
- Checar agrupamento e navegação
- Confirmar que conteúdo e especificações não mudaram

## Entregáveis
- Migração SQL para atualização de títulos
- Ajustes pontuais de renderização nos componentes (WorkoutDay/Home/Progress)
- Validação manual e breve documentação de mapeamento