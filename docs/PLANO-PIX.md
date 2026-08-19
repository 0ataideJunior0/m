# Plano — Pagamento via Pix (fora de Assinaturas)

**Status:** 🟡 **DESENHADO, NÃO IMPLEMENTADO** — deliberadamente. Ver §7.
**Data:** 2026-08-19
**Pré-requisito de leitura:** [`PLANO-MERCADOPAGO.md` §14](PLANO-MERCADOPAGO.md) — por que Pix **não** cabe dentro de Assinaturas.
**Relacionado:** [`../marketing/funil-e-lancamento.md`](../marketing/funil-e-lancamento.md)

---

## 1. Por que isto existe

O fluxo de cobrança que está em produção aceita **somente cartão de crédito**. Num produto de R$ 59,90/mês vendido para público amplo no Brasil, isso é um limitador de alcance real: exclui quem não tem cartão e quem tem receio de cadastrá-lo.

O Pix resolve o alcance, mas **não pode ser recorrente** (§14 do plano do MP). A saída é vendê-lo como **pagamento à vista de um plano de período mais longo**, convivendo com a assinatura no cartão.

**Por que período longo e não Pix mensal:** sem débito automático, mensal significa 12 pagamentos manuais por ano — 12 oportunidades de esquecer e sair. Trimestral são 4, semestral são 2. O período longo também melhora caixa e permite um desconto que torna a oferta atraente sem canibalizar o plano no cartão.

---

## 2. O que muda e, principalmente, o que NÃO muda

**Não muda nada disto** — e é o motivo de o custo desta feature ser moderado, não alto:

| Componente | Por quê |
|---|---|
| `has_active_subscription()` | Já libera acesso enquanto `next_payment_date` estiver no futuro. Um Pix de 3 meses é só gravar essa data 3 meses à frente. **Zero alteração.** |
| RLS de `workouts` e `meal_plans` | Chamam a função acima. Zero alteração. |
| `RequireSubscription`, `RequireOnboarding`, rotas | Leem `hasActiveSubscription`, que vem da mesma função. Zero alteração. |
| Fluxo de cartão em produção | Continua no ar, intocado, funcionando em paralelo. |

**Muda:**

- schema de `subscriptions` (fase P1)
- `api/mercadopago-webhook.ts` passa a tratar um segundo tópico (P3)
- endpoint novo para gerar a cobrança (P2)
- tela nova de QR Code (P4)
- mecanismo de aviso de vencimento, que **hoje não existe** (P5)

---

## 3. Fase P0 — Decisões de produto (bloqueante, não é código)

Nenhuma linha deve ser escrita antes destas quatro respostas.

**P0.1 — Período do plano.**
Recomendação: **trimestral**. Semestral prende mais, mas o valor cheio à vista (≈R$ 180 com desconto) é uma barreira alta para uma marca que ainda não tem prova social. Trimestral equilibra ticket e fricção.

**P0.2 — Preço.**
Precisa ser vantajoso o bastante para justificar pagar adiantado, sem tornar o plano mensal no cartão irrelevante. Referência: 3 × R$ 59,90 = R$ 179,70 → algo como **R$ 149,90 à vista** (≈17% off).

**P0.3 — Conflito cartão × Pix.** ⚠️ **A decisão mais importante desta lista.**
Hoje `subscriptions.user_id` é **UNIQUE** — uma linha por usuária. Então é preciso definir o que acontece quando:
- alguém com assinatura ativa no cartão paga um Pix
- alguém com Pix vigente assina no cartão
- alguém paga dois Pix seguidos (renovação antecipada — deveria somar o período, não substituir?)

Sem uma regra explícita aqui, um caso desses **sobrescreve silenciosamente o acesso pago da usuária** — exatamente a classe de bug que já corrigimos no webhook (`fce843d`).

**P0.4 — Aviso de vencimento: quando e por qual canal?**
É o elo mais fraco do modelo Pix. Sem aviso, a churn será alta e silenciosa. Opções: banner no app a partir de X dias do fim, e-mail, ou os dois.

---

## 4. Fases de implementação

### P1 — Schema

`subscriptions` foi desenhada assumindo que toda linha vem de uma `preapproval`:

```sql
preapproval_id TEXT NOT NULL UNIQUE
```

Um pagamento Pix não tem `preapproval_id`. Migration necessária:

```sql
ALTER TABLE public.subscriptions ALTER COLUMN preapproval_id DROP NOT NULL;
ALTER TABLE public.subscriptions ADD COLUMN source TEXT NOT NULL DEFAULT 'preapproval';  -- 'preapproval' | 'pix'
ALTER TABLE public.subscriptions ADD COLUMN payment_id TEXT;                              -- id da order/payment do Pix
```

**Decisão de reúso deliberada:** `next_payment_date` é reaproveitada como "data em que o acesso acaba", em vez de criar uma coluna nova. Semanticamente é a mesma coisa nos dois modelos ("quando ela precisa pagar de novo"), e reusar é o que mantém `has_active_subscription()` sem alteração — o benefício descrito na §2.

> ⚠️ **Cuidado:** esta migration mexe na tabela que **gateia o acesso de todas as assinantes pagantes em produção**. `DROP NOT NULL` e `ADD COLUMN ... DEFAULT` são operações seguras e não bloqueantes no Postgres, mas a fase precisa do mesmo rigor da M5: aplicar fora de pico e verificar o gate logo em seguida.

> 🔎 **Ponto em aberto:** a folga de 3 dias em `has_active_subscription()` (`next_payment_date > NOW() - INTERVAL '3 days'`) existe para cobrir atraso de cobrança no cartão. Num plano Pix ela vira 3 dias de acesso grátis após o vencimento. É pequeno e talvez aceitável — mas é uma decisão consciente, não um detalhe a ignorar.

### P2 — Backend: gerar a cobrança Pix

Endpoint novo, espelhando `api/create-subscription.ts` (mesma autenticação por Bearer + `supabaseAdmin.auth.getUser`).

Chama `POST /v1/orders` — **não** é o SDK de `PreApproval`:

```
payment_method: { id: 'pix', type: 'bank_transfer' }
external_reference: user.id        // mesmo padrão do preapproval
expiration_time: (padrão 24h; configurável de 30min a 30 dias)
```

Requisitos que a documentação marca como obrigatórios e são fáceis de esquecer:
- header **`X-Idempotency-Key`** (UUID v4) — sem ele a request é rejeitada, e é o que evita cobrança duplicada
- `total_amount`, `external_reference`, `processing_mode`, `payer.email`

Retorna `qr_code` (copia e cola), `qr_code_base64` (imagem) e `ticket_url` (página pronta do MP), com `status: action_required` / `status_detail: waiting_transfer` até o pagamento cair.

### P3 — Webhook: creditar o acesso

`api/mercadopago-webhook.ts` hoje só reconhece `subscription_preapproval` e ignora o resto com `200 {ignored:true}`. Passa a tratar também o tópico de order/pagamento.

Ao confirmar pagamento aprovado, grava em `subscriptions`:

```
source            = 'pix'
payment_id        = <id do pagamento>
preapproval_id    = NULL
status            = 'authorized'
next_payment_date = NOW() + <período de P0.1>
```

> ⚠️ **A guarda anti-sobrescrita precisa ser estendida.** A proteção atual (commit `fce843d`) compara `preapproval_id` para não deixar uma notificação atrasada derrubar uma assinatura mais nova. Com duas origens possíveis, essa lógica precisa considerar `source` também — senão reintroduzimos o mesmo bug por outro caminho. **Este é o ponto de maior risco de regressão de toda a feature**, porque o modo de falha é silencioso: tira acesso de quem pagou.

> 🔎 **Confirmar na implementação:** o nome exato do tópico da notificação (a doc de Orders menciona "notificações do tópico Order"). Não assumir — validar contra uma notificação real, pelo mesmo motivo listado no §14 do plano do MP.

### P4 — Frontend: escolha e tela de QR Code

- `/subscribe` ganha a escolha entre **cartão (mensal, automático)** e **Pix (trimestral, à vista)**, deixando explícita a diferença de renovação — não deixar a usuária descobrir depois que o Pix não renova sozinho.
- Tela de Pix: QR Code (`qr_code_base64`), botão de copiar (`qr_code`), e o prazo de expiração visível.
- Confirmação: reaproveitar o padrão de polling que já existe em `Subscribe.tsx` (o mesmo do retorno do checkout de cartão), incluindo o estado de "processando" e o timeout — nunca mostrar erro para quem acabou de pagar.

### P5 — Vencimento e renovação

O que não existe hoje e é o que decide se o modelo Pix funciona:

- query de assinaturas Pix vencendo em X dias (mesma família das queries de monitoramento da M6.2)
- banner no app a partir de X dias do fim, com botão de renovar
- e-mail de aviso, se decidido em P0.4
- renovar = gerar uma nova cobrança; conforme P0.3, decidir se soma ao período restante ou substitui

### P6 — Testes e ativação

- verificar se o **sandbox do MP suporta Pix** — não assumir; o Pix de teste pode não gerar QR pagável, e nesse caso o primeiro teste real já é com dinheiro de verdade
- teste real de ponta a ponta em produção, como na M5 passo 2
- confirmar que o acesso liga ao pagar e **desliga na data certa** (é o que nunca foi exercitado no fluxo de cartão, porque lá o MP cuida disso)
- confirmar que uma assinante de cartão existente não é afetada por nada disso

---

## 5. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Migration em tabela que gateia acesso pago | alta | Operações são não-bloqueantes; aplicar fora de pico e verificar o gate imediatamente (rigor da M5) |
| Guarda anti-sobrescrita não cobrir `source` | **alta** | Falha silenciosa que tira acesso de quem pagou. Testes cobrindo os cruzamentos de P0.3 antes de subir |
| Churn por falta de aviso de vencimento | alta | P5 não é opcional — sem ela o modelo Pix perde a cliente sem ninguém perceber |
| Sandbox não suportar Pix | média | Descobrir em P6 **antes** de depender disso; orçar um teste real |
| Nome do tópico de notificação errado | baixa | Validar contra notificação real, não contra a doc |

---

## 6. Ordem

```
P0 decisões de produto  ← bloqueante, não é código
  └─ P1 schema
       └─ P2 gerar cobrança ──┐
                              ├─ P4 frontend
       └─ P3 webhook ─────────┘
            └─ P5 vencimento/renovação
                 └─ P6 testes e ativação
```

P2 e P3 são independentes entre si e podem ser feitos em paralelo.

---

## 7. Por que isto NÃO está implementado

Decisão consciente de sequenciamento, tomada em 2026-08-19.

O fluxo de cartão acabou de ser validado em produção (M5) e o relançamento ainda não aconteceu — **não existe um único número de conversão real**. Construir Pix agora é apostar que a falta dele é o gargalo, sem evidência.

O caminho barato é o inverso: **lançar, medir quantas pessoas chegam em `/subscribe` e não concluem**, e só então decidir. Se a conversão for boa, o Pix não era o problema e o esforço foi economizado. Se for ruim, os dados dirão inclusive **qual período** faz sentido — em vez de chutar entre trimestral e semestral na fase P0.1.

O `marketing/funil-e-lancamento.md` já identifica a conversão cadastro → assinatura como *a* métrica-chave e aponta que hoje o funil não é medido em nenhuma etapa. **Instrumentar o funil vem antes desta feature.**
