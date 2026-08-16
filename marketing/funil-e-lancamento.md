# Funil e Lançamento — MusaFit

**Data:** 2026-08-13
**Contexto:** o pagamento acontece dentro da plataforma (Mercado Pago Assinaturas, via `preapproval`), não numa plataforma de infoproduto. Este documento trata das consequências disso no funil, do que precisa ser instrumentado, e da sequência de lançamento.

**Relacionado:** [`pagina-de-vendas.md`](pagina-de-vendas.md) · [`../docs/PLANO-MERCADOPAGO.md`](../docs/PLANO-MERCADOPAGO.md)

---

## 1. A premissa que muda tudo

Em Kiwify ou Hotmart, o link do anúncio vai **direto para o checkout**. Uma tela entre o clique e o pagamento.

No MusaFit, o pagamento mora dentro do app e depende de uma conta existir antes (o `external_reference` da assinatura é o `user.id` do Supabase). O caminho fica:

```
anúncio/story → página de vendas → cadastro → onboarding → paywall → Mercado Pago → retorno → acesso
```

**Sete etapas.** Cada uma perde gente. Essa é a desvantagem estrutural de ter o pagamento em casa — e o preço que se paga pela taxa de 4,99% em vez de 7% + R$1, e por ser dono do relacionamento com a cliente.

A resposta não é abandonar o pagamento próprio. É **encurtar o funil onde dá** e **medir onde ele vaza**.

---

## 2. Encurtar: tirar o onboarding de antes do pagamento

> 🔄 **Isto revisa a Tarefa M3.3 do `PLANO-MERCADOPAGO.md`.** Lá está escrito que `RequireOnboarding` deve vir antes de `RequireSubscription`, com o argumento de que "fazer a usuária pagar antes de dizer o próprio nome é fricção sem motivo". Olhando o funil inteiro, o argumento se inverte.

O onboarding pede idade, sexo, objetivo, altura e peso. **Nada disso convence ninguém a comprar.** Colocado antes do checkout, ele é uma tela de cinco campos entre uma pessoa decidida e o cartão dela.

Depois do pagamento, a conclusão do onboarding é altíssima — quem acabou de pagar termina o cadastro. Antes, é só obstáculo.

**Ordem recomendada:**

```
página de vendas → cadastro (só e-mail + senha) → checkout → pagamento → onboarding → app
```

**Implementação:** em `App.tsx`, inverter a composição dos guards nas rotas de conteúdo —

```tsx
<RequireSubscription><RequireOnboarding><WorkoutDay /></RequireOnboarding></RequireSubscription>
```

E a rota `/subscribe` **não** pode exigir onboarding. Hoje o `RequireOnboarding` envolve quase tudo em `App.tsx`; a tela de assinatura precisa ficar de fora, senão a usuária não paga sem antes preencher o formulário que a gente acabou de decidir adiar.

**Cuidado a checar:** `RequireAdmin` deve contornar a checagem de assinatura. Admin não assina.

---

## 3. O funil, tela a tela — onde vaza e o que fazer

| # | Etapa | Vazamento típico | O que reduz |
|---|---|---|---|
| 1 | Story/Reels → clique no link | Curiosidade sem intenção | Chamada específica ("o app que uso com as alunas"), não genérica ("link na bio") |
| 2 | Página de vendas → clique no CTA | Não entendeu o que é, não confiou | Seção da Evelly preenchida, depoimentos reais, FAQ de equipamento |
| 3 | Cadastro | Formulário longo, senha exigente, e-mail de confirmação | **Só e-mail e senha.** Verificar se o Supabase exige confirmação de e-mail — se exigir, isso trava o funil no meio e precisa ser desligado ou tratado |
| 4 | Paywall → clique em assinar | Preço apareceu de surpresa | O preço já estava na página de vendas. Repetir o que está incluído na tela de assinatura |
| 5 | Redirect → Mercado Pago | Desconfiança, cartão não à mão | Dizer antes que vai abrir o Mercado Pago. Marca conhecida ajuda — use isso a favor |
| 6 | Pagamento → retorno | Webhook atrasa, tela mostra erro | Estado de "processando" com repoll, nunca mensagem de falha (Tarefa M3.2) |
| 7 | Onboarding → primeiro treino | Sumiu depois de pagar | Levar direto ao treino do dia, não à Home genérica |

**A etapa 6 é a mais perigosa.** A usuária pagou de verdade e vê uma tela de erro porque o webhook ainda não chegou. Ela pede reembolso e não volta. Vale mais atenção que qualquer otimização de copy.

---

## 4. Instrumentação — o estado real hoje

Fui olhar o que existe. É menos do que a documentação afirma.

**O que existe:**
- Vercel Web Analytics inicializado em `index.html` (script inline + `/_vercel/insights/script.js`)
- `src/utils/analytics.ts` com `trackEvent(name, data)`
- **Exatamente um evento disparado em todo o app:** `DayCompleted`, em `Profile.tsx:160`

**O que a documentação afirma e não é verdade:** `docs/analytics.md` diz que existem eventos `StartWorkout` na Home e `ShareAchievements` no Perfil. **Nenhum dos dois existe no código.** Corrigir esse arquivo junto (é do mesmo tipo de defasagem que a Fase 7 do plano de correções trata).

**Conclusão:** para efeitos de funil, hoje você está cego. Nenhuma etapa de 1 a 7 é medida.

### 4.1 Eventos mínimos a instrumentar

Sem isto, você não saberá qual etapa consertar:

| Evento | Onde disparar |
|---|---|
| `SalesPageView` | página de vendas |
| `SalesPageCTA` | clique no botão principal |
| `SignupStarted` | `Register.tsx`, ao submeter |
| `SignupCompleted` | conta criada com sucesso |
| `PaywallView` | `RequireSubscription` bloqueou o acesso |
| `CheckoutStarted` | clique em assinar, antes do redirect |
| `SubscriptionAuthorized` | **no webhook**, não no cliente |
| `OnboardingCompleted` | `Onboarding.tsx` |
| `FirstWorkoutOpened` | primeiro `WorkoutDay` após assinar |

### 4.2 Por que `SubscriptionAuthorized` tem que sair do servidor

O pagamento se completa no domínio do Mercado Pago. A usuária pode fechar o navegador antes de voltar, o retorno pode falhar, o app pode não carregar. **Conversão medida no cliente perde parte das vendas** — e no caso do Meta, conversão perdida significa algoritmo mal treinado e custo por aquisição inflado.

O lugar certo é `api/mercadopago-webhook.ts`, no momento em que a assinatura vira `authorized`. Dali sai:

- o evento de analytics interno
- o evento para a **API de Conversões do Meta** (server-side), se/quando houver anúncio pago

Isso entra na Fase M2 do plano do Mercado Pago, junto com a restauração do webhook.

### 4.3 O que dá para responder só com SQL

Não precisa de ferramenta paga para as métricas que mais importam. Com `profiles` e `subscriptions` no Supabase:

- contas criadas por dia
- assinaturas autorizadas por dia
- **conversão cadastro → assinatura** (a métrica-chave)
- assinaturas presas em `pending` há mais de 1 hora → webhook quebrado
- cancelamentos por semana
- tempo médio entre cadastro e assinatura

Monte isso como um painel simples. É mais confiável que qualquer analytics de cliente porque vem do banco.

---

## 5. Vazamento que ninguém vê: o link não tem preview

Achado original no `index.html` (auditoria de 2026-08-13):

```html
<html lang="en">
<title>Musa Fit20</title>
```

**Três problemas, todos relevantes para um lançamento no Instagram:**

1. **Nenhuma tag Open Graph.** Quando alguém compartilha o link no WhatsApp ou o cola no story, aparece um retângulo cinza sem imagem, sem título e sem descrição. Num lançamento que vai viver de compartilhamento, isso é perda direta de clique.
2. **`lang="en"`** numa página inteiramente em português.
3. **`Musa Fit20`** — nome antigo, com o "20" do desafio de 20 dias que o produto deixou de ser.

> ✅ **Item 3 resolvido em 2026-08-13** (renomeação para MusaFit). O `<title>` agora é `MusaFit — Treinos para mulheres, dia a dia`.
> ⬜ **Itens 1 e 2 continuam pendentes** — `lang="en"` e ausência de Open Graph seguem no arquivo.

**Correção do que falta (rápida e de alto retorno):**

```html
<html lang="pt-BR">
<title>MusaFit — Treinos para mulheres, dia a dia</title>
<meta name="description" content="Programas de treino estruturados para mulheres, com vídeo em cada exercício e progresso salvo. Treine em casa, no seu ritmo.">

<meta property="og:type" content="website">
<meta property="og:title" content="MusaFit — Seu treino de hoje já está pronto">
<meta property="og:description" content="Programas de treino estruturados para mulheres, com vídeo em cada exercício e progresso salvo.">
<meta property="og:image" content="https://SEU-DOMINIO/og-image.jpg">
<meta property="og:url" content="https://SEU-DOMINIO">
<meta name="twitter:card" content="summary_large_image">
```

A imagem OG precisa ter **1200×630px**. Vale uma arte com o nome, uma foto e a frase principal. Validar depois no compartilhador de links do Facebook e mandando para si mesmo no WhatsApp.

---

## 6. Sequência de lançamento — audiência da Evelly primeiro

**Por que não começar com anúncio pago:** você tem ~20 usuárias e conversão nunca medida. Não sabe se a página converte, quanto vale uma assinante, nem quanto tempo ela fica. Sem esses três números não dá para calcular quanto pode pagar por clique — anunciar agora é comprar tráfego para um funil que você não sabe se retém.

A audiência do [@evellycassia_](https://instagram.com/evellycassia_) é quente, custa zero e responde rápido. É lá que se descobre se a oferta funciona.

### D-7 a D-4 — Problema, sem falar do produto

Stories e um Reels sobre a **experiência**, não sobre o app:

- o print de treinos salvos que nunca foram feitos
- "quantas vezes você começou na segunda e parou na quarta?"
- caixinha de pergunta: *"o que mais te trava pra treinar em casa?"*

A caixinha faz dois trabalhos: aquece a audiência e te entrega, com as palavras delas, as objeções que vão para a página de vendas.

### D-3 a D-2 — Existe uma solução

- Evelly conta por que criou o MusaFit (é o mesmo conteúdo da seção 7 da página de vendas — escrever uma vez, usar nos dois lugares)
- gravação de tela: abrir o app, o treino do dia já montado, o checklist enchendo
- **abrir lista de espera** — link na bio para captar e-mail/WhatsApp

> A lista de espera é o item mais subestimado desta sequência. Ela transforma um lançamento de um dia em uma lista que você pode reativar para sempre. E te dá um número de intenção antes de qualquer linha de código de pagamento entrar no ar.

### D-1 — Contagem

- "amanhã abre"
- responder na caixinha as objeções que apareceram no D-7

### D0 — Abertura

- Story de manhã com o link
- Reels no feed
- **Mensagem direta para toda a lista de espera** — é o que mais converte do lançamento inteiro
- Evelly disponível para responder DM o dia todo

### D+1 a D+3 — Prova social em tempo real

- reposte (com autorização) quem assinou e postou
- print das primeiras usando o app
- responda publicamente as dúvidas que chegarem na DM — a dúvida de uma é a dúvida de trinta

### Depois

As primeiras 30–50 assinantes saem daqui, sem custo de mídia. **Só depois** disso, com número de conversão e retenção na mão, é que faz sentido testar Meta Ads.

---

## 7. Os números que importam

Preencha conforme forem chegando. **Não use estimativa como se fosse dado** — o objetivo destas linhas é serem substituídas por realidade.

| Métrica | Como medir | Meta inicial |
|---|---|---|
| Cliques no link | Vercel Analytics | — |
| Conversão página → cadastro | `SalesPageCTA` → `SignupCompleted` | `[medir]` |
| Conversão cadastro → assinatura | SQL: `subscriptions` ÷ `profiles` | **a métrica-chave** |
| Assinaturas presas em `pending` | SQL | **zero** — qualquer valor > 0 é webhook quebrado |
| Cancelamento no 1º mês | SQL | `[medir]` |
| Tempo médio até o 1º treino | SQL | quanto menor, melhor a retenção |

**A que decide tudo é cadastro → assinatura.** Se ela ficar baixa, o problema está entre a etapa 3 e a 6 da tabela do §3, e nenhuma quantidade de tráfego resolve. Se ficar boa, aí sim faz sentido comprar tráfego.

**A segunda mais importante é o cancelamento no primeiro mês.** Assinatura que cancela em 30 dias não paga aquisição. Se estiver alta, o problema é produto ou expectativa criada na venda — não é marketing.

---

## 8. O que não fazer agora

- **Meta Ads antes de medir o funil orgânico.** Sem saber conversão e retenção, você não tem como saber quanto pode pagar por clique.
- **Google Ads.** Ninguém busca por "app de treino feminino" em volume que justifique. A demanda aqui é gerada, não capturada.
- **Programa de afiliados.** O pagamento próprio não tem essa infraestrutura pronta, ao contrário de Hotmart e Kiwify. Construir isso agora é caro e prematuro.
- **Anunciar antes da Fase M5 do plano do Mercado Pago estar validada em produção.** Mandar tráfego para um checkout que não funciona queima a audiência quente uma única vez — ela não volta com a mesma disposição.

---

## 9. Ordem de execução

```
1. Metadados + OG tags no index.html          ← barato, alto retorno, faça já
2. Instrumentar os 9 eventos do funil (§4.1)
3. Inverter a ordem dos guards (§2)
4. Publicar a página de vendas
5. Validar pagamento ponta a ponta em produção (Fase M5)
6. Lista de espera (D-3)
7. Lançar para a audiência da Evelly (D0)
8. Medir 2–4 semanas
9. Só então avaliar tráfego pago
```

Os itens 1 a 3 são código e podem ser feitos em paralelo às fases do plano do Mercado Pago. **O item 5 é bloqueante do 7** — não anuncie antes de ter pago com cartão real e visto o acesso liberar sozinho.
