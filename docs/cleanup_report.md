# Relatório de Limpeza e Otimização

## Inventário de Tabelas (Supabase)
- `workouts`: usado em `getWorkoutByDay`, Progress/Home. Índice em `day_number`.
- `user_progress`: usado para marcar dias concluídos e timeline. Índice `(user_id, day_number)`.
- `user_exercise_progress`: usado no checklist por exercício. Índice `(user_id, day_number, exercise_key)`.
- `pdf_plans`: usado para obter links de PDFs na Home.

## Código Removido/Ajustado
- HIIT: remoção de blocos comentados grandes (desuso).
- Code-splitting por rotas com `React.lazy/Suspense`.
- Vite `manualChunks`: separação vendor/app.

## Próximos candidatos a limpeza
- Verificar imports não usados em páginas que crescerem.
- Consolidar normalização de vídeos/exercícios em utils únicos.

## Performance
- Índices adicionados (perf_indexes.sql).
- Bundle otimizado (code-splitting e chunks).

## Métricas
- Coletar após build: tamanho gzip/chunks.
- Latência de queries após índices.

