# Achados extras

Registro de coisas encontradas **fora do escopo** da fase em execução, conforme a Regra geral 4 do `PLANO-CORRECOES.md`: não refatorar oportunisticamente — anotar e seguir.

Cada item traz a fase em que foi encontrado. Nada aqui foi corrigido.

---

## Fase 0.5

### A-1 — Aviso "não encontramos seu nome" nunca existiu na UI

O teste `Dashboard.test.tsx` (removido nesta fase) afirmava dois comportamentos na tela inicial:

1. saudação com o `username`, e fallback para o prefixo do e-mail quando ele falta — **existe** em `Home.tsx` (`displayName`)
2. um aviso visível com o texto *"não encontramos seu nome"* quando o `username` está ausente — **nunca existiu**. `grep -r "encontramos seu nome" src/` só encontrava o próprio teste

O teste importava `../pages/Dashboard`, arquivo que também nunca existiu no repositório — ele falhava na resolução do import, então **nenhuma das duas asserções chegou a rodar**. O teste nasceu quebrado no commit inicial (`6606816`) e assim ficou.

Ao repontar para `Home.tsx`, a asserção (1) foi preservada e a (2) descartada, por descrever UI inexistente.

**Decisão de produto em aberto:** vale mostrar um aviso quando a usuária não tem `username`? Hoje o fallback silencioso para o prefixo do e-mail pode exibir algo como *"Olá, maria.silva92!"*. O onboarding obrigatório (`Onboarding.tsx`) deveria garantir que todo mundo tenha nome, o que tornaria o aviso desnecessário — **verificar se contas criadas antes do onboarding obrigatório podem estar sem `username`**.

### A-2 — Cobertura de teste da Home é rasa

`Home.test.tsx` cobre apenas a saudação. Não cobre: renderização dos cards de programa, o redirecionamento para `/login` quando não autenticada, nem o modal de PDF. Fora do escopo da Fase 0.5, que só precisava destravar a suíte.

---

## Fase 1

### A-3 — Repositório vive dentro do OneDrive

O projeto está em `OneDrive/Documentos/musaApp`. O OneDrive sincroniza `node_modules` independentemente do `.gitignore`, o que causa lentidão e corrupção intermitente de binários nativos (`@rollup/rollup-*`, `sharp`).

**Recomendação ao humano:** mover o repositório para fora da pasta sincronizada (ex.: `C:\dev\musaApp`). **Decisão do humano — o agente não move nada.**

---

## Fase 2

### A-4 — `id` estável por exercício no JSONB

A chave de exercício corrigida na Fase 2 passa a depender da **posição** do exercício no array. Editar a lista no painel admin (inserir, remover ou reordenar) desloca os índices e invalida as chaves já salvas.

A solução definitiva é dar a cada exercício um `id` estável dentro do JSONB, gerado na criação e nunca reutilizado. Exige migração de dados e mudança no editor do admin — **declarado fora de escopo pelo próprio plano**.
