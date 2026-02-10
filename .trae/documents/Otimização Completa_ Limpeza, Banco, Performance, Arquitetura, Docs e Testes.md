## Objetivo
Remover elementos obsoletos, padronizar e otimizar o projeto end‑to‑end (código, banco, bundle, UX, docs e testes), com métricas comparativas antes/depois.

## Escopo do Projeto (estado atual)
- Frontend: Vite + React + Tailwind; páginas principais (Home, WorkoutDay, Progress, Profile, Login/Registro, HIIT). Ícones lucide-react.
- Supabase: tabelas públicas principais (workouts, user_progress, pdf_plans, user_exercise_progress).
- Build atual ~550 kB gzip com aviso de chunk grande; sem code-splitting por rotas.

## Plano de Execução
### 1) Limpeza de Código
- Mapear arquivos mortos e trechos legados/comentados (ex.: blocos comentados em HIIT, redundâncias em Progress/Home).
- Remover imports não usados, variáveis não referenciadas, e comentários de código legado.
- Auditar dependências no package.json, retirar libs não utilizadas e consolidar versões.
- Criar um relatório de remoções com referência de arquivos/linhas.

### 2) Banco de Dados: Mapeamento e Higienização
- Inventariar tabelas existentes e seus usos:
  - workouts: usada por getWorkoutByDay e Progress/Home.
  - user_progress: usada para marcar dias concluídos e timeline.
  - user_exercise_progress: usada no checklist por exercício.
  - pdf_plans: usada para gerar links dos PDFs na Home.
- Gerar matriz de referência (queries → tabelas, migrations → tabelas).
- Identificar tabelas sem uso efetivo (históricas/testes) e propor exclusão:
  - Processo: backup (dump), remoção controlada, exclusão de migrations/seeders/modelos associados.
- Índices/constraints:
  - Verificar índices em (workouts.day_number), (user_progress.user_id, day_number), (user_exercise_progress.user_id, day_number, exercise_key); propor criação/ajuste se faltar.

### 3) Performance
- Queries: eliminar N+1, usar selects específicos e evitar `select *` em rotas quentes; paginar quando aplicável.
- Cache:
  - Client: cache local para vídeos e progresso (já existe para exercícios; expandir para workouts por dia com TTL curto).
  - Server: avaliar cached endpoints/CDN para assets estáticos e páginas públicas.
- Bundle:
  - Code-splitting por rotas com React.lazy/Suspense (Login, Register, WorkoutDay, Progress, Profile, HIIT).
  - rollup manualChunks para vendor (react/react-dom/lucide) e app.
  - Tree‑shake ícones (import pontual) e remover módulos não utilizados.
- Assets:
  - Converter logo/figuras para WebP/AVIF, manter fallback PNG.
  - Habilitar preloads/`rel=preload` onde relevante (fonts/critical CSS).
- Lazy loading
  - Componentes pesados (vídeo/modal) com carregamento sob demanda.
- Cache headers/CDN
  - Configurar headers de cache para `dist` e CDN (Vercel) com long‑term cache e invalidation por build.

### 4) Arquitetura
- Revisar camadas:
  - Separar módulos: `utils/*` (auth, workouts, progress), `components/*` (UI), `pages/*` (rotas).
  - Aplicar SOLID/DRY/KISS onde há acoplamentos (ex.: lógica de normalização de exercícios e vídeo centralizada).
- Serviços
  - Consolidar acesso Supabase em `lib`/`services` com funções coesas e tipadas.
  - Avaliar microserviços apenas se houver gargalos reais; manter monolito até justificativa.

### 5) Documentação
- Atualizar README com setup otimizado (env, comandos, build, testes, deploy).
- Diagramas de banco atualizados (tabelas/relacionamentos e índices).
- Relatório de limpeza/otimização com tabela antes/depois.

### 6) Testes
- Unitários: utils (chaves, merges, normalizações), componentes (render e acessibilidade).
- Integração: páginas (WorkoutDay checklist, Progress semanas), fluxo de login/registro e recuperação.
- e2e (opcional): navegação básica, marcação de exercícios, vídeos embutidos.
- Executar suite completa; corrigir regressões.

### 7) Métricas Finais
- Coletar antes/depois:
  - Bundle (tamanho gzip, número de chunks).
  - Tempo de build.
  - Performance de queries (latência média em rotas principais).
  - Cobertura de testes (% linhas/branches).
  - Tempo de resposta médio da aplicação em páginas chave.

## Critérios de Aceitação
- Sem funcionalidade quebrada; UI consistente.
- Tabelas sem uso removidas após backup e documentação.
- Bundle reduzido e com code‑splitting; assets otimizados.
- Docs atualizadas e testes passando.

Confirma que podemos iniciar a execução conforme este plano (limpeza + banco + performance + arquitetura + docs + testes + métricas)?