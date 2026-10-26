# Checkout "pagar primeiro" + medição do funil — design

Data: 2026-10-26 · Status: aguardando aprovação

## Intenção

Encurtar o caminho entre o anúncio e a primeira venda. Hoje quem vem da página de vendas precisa criar conta, confirmar o e-mail, voltar, fazer login e só então pagar — passos demais para quem chega pelo Instagram no celular. O novo caminho: a pessoa escolhe o plano na landing page, digita o e-mail, paga, e só depois recebe um e-mail para criar a senha e entrar.

Junto disso, medir cada etapa do funil e a origem do tráfego, para o dono saber onde as pessoas desistem quando começar a investir em Meta Ads.

O tráfego virá de Instagram orgânico e de anúncios pagos na Meta — ou seja, a maior parte das compras acontece **dentro do navegador do Instagram, no celular**.

## Etapas

Este documento cobre a **Etapa 1**. A Etapa 2 fica registrada para depois.

- **Etapa 1 — agora:** checkout pagar-primeiro, primeiro acesso por link no e-mail com senha obrigatória, remoção da confirmação de e-mail no cadastro direto, medição do funil com UTMs e tela "Funil" no painel admin, links da landing page.
- **Etapa 2 — quando o dono configurar a conta de anúncios:** Pixel da Meta na landing page + aviso de compra aprovada enviado pelo servidor (Conversions API) a partir do webhook do Mercado Pago, com valor. O dono ainda não tem Pixel criado. A Etapa 1 já grava as UTMs, então nada se perde até lá.

## Objetivos (Etapa 1)

1. **Página de pagamento sem login** no app, aberta pelos cards da landing page com o plano já escolhido (ex.: `musafit.me/comprar?plano=trimestral`, com UTMs junto).
2. Na página: a pessoa **digita só o e-mail** e paga — **cartão** no plano mensal recorrente, **Pix** nos planos de 1/3/6/12 meses (os mesmos planos e preços de hoje, `api/_lib/pixPlans.ts` e `CARD_MONTHLY_PRICE`).
3. **Logo depois de pagar**, ela é levada à **tela de login com um aviso para conferir o e-mail**.
4. Quando o Mercado Pago confirma o pagamento:
   - **e-mail sem conta (ou com conta nunca provada — ver abaixo):** cria a conta e envia o **e-mail de acesso**;
   - **e-mail que já tem conta provada:** **só libera o acesso** (mesmas regras de hoje: empilha períodos de Pix, preserva acesso pré-pago etc.). Ela entra com a senha que já tem; nada de e-mail de criar senha.
5. **E-mail de acesso:** um botão só, "Acessar minha conta", que já faz o login (link mágico). Ela cai numa tela para **criar a senha — obrigatório** — e depois segue para o onboarding de hoje e os treinos.
6. **Quem chega direto no app** continua podendo **criar conta e depois pagar**, como hoje.
7. **Tirar a confirmação de e-mail do cadastro direto** (desligar "Confirm email" no Supabase e ajustar o app).
8. **Medição:** registrar data/hora de cada etapa por compradora e a origem (UTMs); tela **Funil** no painel admin.
9. **Landing page** (repositório separado; o dono dá acesso na hora de implementar): cada card de plano aponta para a página de pagamento com o plano e repassa as UTMs da visita.
10. **Assuntos dos e-mails do Supabase em português** (hoje o modelo já tem a cara da marca, mas o assunto ainda é "Reset Your Password").

## Não-objetivos

- Login com Google (bloqueado no navegador do Instagram).
- Pixel da Meta / Conversions API (Etapa 2).
- Cupom de desconto (ver memória: nativo do MP só via Wallet Connect; quando vier, validação própria no backend).
- Mudar preços, planos ou a forma como o acesso é calculado depois de pago.
- Mudar o login normal de quem já usa o app.

## Anti-objetivos (seria fracasso mesmo funcionando)

- **Alguém conseguir ficar com a conta de outra pessoa** — pagando com o e-mail dela, ou criando conta com o e-mail dela no cadastro direto e herdando a compra que a dona fizer depois.
- **Pagou e ficou sem acesso** sem saber o que fazer (e-mail digitado errado, link expirado, e-mail na caixa de spam).
- **Encher o banco de contas de quem desistiu** ou mandar e-mail para endereços que nunca pagaram.
- Algo que só funcione fora do navegador do Instagram.

## Decisões do dono

- Paga **antes**, recebe o e-mail **depois**.
- Depois de pagar → **tela de login com aviso** para conferir o e-mail.
- E-mail que já tem conta → **apenas liberar o treino**.
- Cada card da landing leva direto ao checkout do plano certo.
- Cadastro direto no app continua existindo.
- **Remover a confirmação de e-mail** do cadastro direto (com a proteção descrita abaixo).
- Primeiro acesso pelo link do e-mail, **senha obrigatória**.
- O e-mail de acesso segue o **estilo visual dos e-mails atuais** (marca MusaFit, português).
- Medição no app + tela Funil; Pixel na Etapa 2, nesta ordem.
- Resend já configurado como SMTP do Supabase e **testado** (2026-10-26: e-mail de redefinição chegou como "MusaFit" e aparece nos logs do Resend).

## Como fica

### Intenção de compra

Uma tabela nova (ex. `purchase_intents`) guarda cada checkout iniciado: e-mail (normalizado em minúsculas, sem espaços), plano, forma de pagamento, UTMs (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`) e referência de origem, e as marcas de tempo do funil (ver Medição). O **id da intenção vai no `external_reference`** do Mercado Pago, no lugar do id da usuária. Só o servidor (service role) escreve; admin lê.

A conta **só é criada quando o pagamento é aprovado** — nunca na hora de digitar o e-mail.

### Servidor

- Rotas novas **sem sessão** para criar a cobrança a partir de `{ email, plano, utms }`: Pix (QR code, como `api/create-pix-payment.ts`) e cartão (PreApproval, como `api/create-subscription.ts`). O preço continua vindo só do servidor.
- Proteção básica contra abuso das rotas abertas (validação de e-mail, limite de tentativas por e-mail/IP em janela curta).
- O **webhook** passa a reconhecer referências de intenção além das atuais (id puro de usuária no cartão e o formato do Pix em `api/_lib/pixPeriod.ts`, que continuam valendo para quem paga logada). Ao aprovar:
  1. marca a intenção como paga;
  2. acha a usuária pelo e-mail ou cria a conta (`auth.admin.createUser`, sem senha) — o `handle_new_user` já cria o perfil;
  3. grava a assinatura pelas regras de hoje;
  4. se for conta nova (ou conta nunca provada), gera o link de acesso e envia o e-mail;
  5. tudo idempotente — o MP reenvia notificações.

### "E-mail provado" (proteção contra conta com e-mail alheio)

Com a confirmação desligada, o Supabase marca todo cadastro como confirmado automaticamente, então essa marca deixa de provar que a pessoa é dona do e-mail. Guardamos isso à parte (ex. `profiles.email_verified_at`):

- é preenchido quando a pessoa **entra por um link enviado ao e-mail** (acesso, link mágico, redefinição de senha);
- contas **criadas antes desta mudança** contam como provadas (a confirmação era obrigatória — migração preenche a partir de `email_confirmed_at`);
- na compra, **conta existente sem e-mail provado é tratada como conta nova**: o e-mail de acesso é enviado e a senha é trocada no primeiro acesso, tirando quem tinha criado a conta sem ser dono do e-mail.

### Telas do app

- **`/comprar`**: plano escolhido no topo (com opção de trocar), campo de e-mail, aviso claro "o acesso vai para **fulana@…** — confira", sugestão para erros comuns de domínio (ex. `gmial.com` → `gmail.com`), botão de pagar. Pix: QR + copiar código, esperando a aprovação na própria tela (como hoje em `Subscribe.tsx`). Cartão: vai ao checkout do MP e volta.
- **Depois de pagar → tela de login** com aviso "Pagamento recebido! Enviamos um link de acesso para fulana@… — confira também o spam", e um botão **"Reenviar link"**.
- **Primeiro acesso** (chegando pelo link do e-mail): tela "Crie sua senha" obrigatória → onboarding de hoje → Home.
- **Cadastro direto** (`Register.tsx`): sem a etapa de confirmar e-mail; cria a conta e entra.

### E-mail de acesso

Estilo dos modelos atuais (marca, português). Assunto e texto em português, um botão "Acessar minha conta". Texto final fica para a implementação, revisado pelo dono.

### Medição e tela Funil

Marcas de tempo por intenção: **checkout iniciado** (e-mail digitado), **pago**, **link aberto**, **senha criada**, **onboarding concluído**, **primeiro treino concluído**. As três últimas são ligadas à usuária criada. Topo do funil (visitas à landing e à página de pagamento): Vercel Analytics, que já está instalado.

Painel admin → **Funil**: período selecionável; quantas pessoas chegaram a cada etapa; quebra por `utm_source`/`utm_campaign`; lista de **pagas que não criaram a senha** (com e-mail e data) e botão **"Reenviar acesso"**.

### Landing page

Repositório separado. Cada card de plano aponta para `https://musafit.me/comprar?plano=<id>` e repassa as UTMs presentes na URL da landing.

## Riscos a investigar antes de construir

- **Cartão (PreApproval) e e-mail do pagador:** no sandbox, o MP exige que `payer_email` seja um usuário de teste real (`docs/spike-mp-log.md`, 2026-08); em produção não foi verificado. O MP pode exigir que a pessoa pague logada numa conta MP com o mesmo e-mail informado em `payer_email`. Se for assim, quem digita um e-mail e tem conta MP com outro não consegue pagar no cartão. Verificar na documentação/sandbox e, se confirmado, decidir a alternativa (ex.: plano de assinatura do MP com e-mail livre, ou orientar no texto da tela).
- **Teste em produção:** o webhook real não dispara no sandbox (ver memória), e o plano de R$ 0,01 hoje exige admin logado. Precisa de um jeito controlado de testar o fluxo sem login (ver "Decisões minhas").
- **Link do e-mail aberto em outro navegador:** o link vem do e-mail e normalmente abre fora do Instagram — o fluxo tem que funcionar sem depender de nada guardado no navegador onde ela pagou.

## Decisões minhas (pode mudar)

- Nome da rota: `/comprar?plano=<id>`; ids iguais aos atuais (`mensal`, `trimestral`, `semestral`, `anual`; cartão = `mensal-cartao` ou equivalente).
- Só um botão no e-mail ("Acessar minha conta"), senha criada logo em seguida.
- Quem já tem conta provada **não recebe e-mail nosso** na compra (o MP já manda o comprovante).
- Plano de teste R$ 0,01 aceito no checkout aberto **só para e-mails de uma lista** configurada no servidor (variável de ambiente), para testar o fluxo de conta nova em produção.
- Link de acesso expirado → tela pede o e-mail e reenvia (só se houver compra paga para ele).
- Aviso de conferência do e-mail + sugestão de domínio digitado errado, para reduzir "paguei e não chegou".
- UTMs gravadas também no cadastro direto, para o Funil comparar os dois caminhos.
- E-mail com **assinatura ativa no cartão** que tenta comprar de novo pela landing: o checkout recusa com "você já tem assinatura ativa — entre na sua conta", para não cobrar em dobro (mesma regra que hoje bloqueia o Pix nesse caso).

## Fica a critério de quem constrói

- Estrutura exata das tabelas, nomes de colunas e de rotas internas.
- Layout das telas, dentro do design system Musafit.
- Como reaproveitar a lógica atual do webhook e da tela de assinatura.
- Testes, seguindo os padrões do repositório.
