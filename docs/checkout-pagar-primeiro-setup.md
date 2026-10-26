# Checkout "pagar primeiro" — checklist de configuração

Este guia é para você (dona do negócio). Siga os passos **na ordem**. A ordem importa: se desligar o "Confirm email" antes do deploy do código, o cadastro antigo quebra.

Legenda: **[Claude]** = o Claude faz, com a sua autorização. **[Você]** = você faz nos painéis.

---

## 0. Aplicar a migração do banco — [Claude, com a sua autorização]

O Claude aplica no banco de produção, depois de inspecionar o estado real do banco.

- Arquivo: `supabase/migrations/20261026120000_pay_first_checkout.sql`
- A migração de proteção da tabela de perfis (`20261026110000_profiles_column_grants.sql`) **já está aplicada**. Não precisa repetir.
- A migração também **bloqueia a troca de e-mail** das contas. O app não oferece essa troca, e com o "Confirm email" desligado (passo 6) ela aconteceria na hora, sem confirmação. Se um dia precisar trocar o e-mail de uma aluna, peça ao Claude: ele desliga a trava só durante a troca.

Você só precisa dizer "pode aplicar". Não faça nada nos painéis neste passo.

---

## 1. Variáveis de ambiente na Vercel — [Você]

1. Abra a Vercel → projeto do app → **Settings** → **Environment Variables**.
2. Adicione (ambiente **Production**):

   | Nome | Valor |
   |---|---|
   | `PUBLIC_APP_URL` | `https://musafit.me` |
   | `CHECKOUT_TEST_EMAILS` | `<e-mails de teste separados por vírgula>` |

   Exemplo de `CHECKOUT_TEST_EMAILS`: `teste1@gmail.com,teste2@gmail.com`
   (sem espaços, sem aspas). Só esses e-mails conseguem comprar o plano `teste` de R$ 0,01.
3. Clique em **Save**.
4. Faça um **redeploy** para as variáveis valerem: **Deployments** → no último deploy, menu **⋯** → **Redeploy**.
   (Se o deploy do passo 5 ainda vai acontecer, ele já pega as variáveis novas; nesse caso não precisa redeploy separado.)

---

## 2. URLs de redirecionamento no Supabase — [Você]

1. Supabase → seu projeto → **Authentication** → **URL Configuration**.
2. Em **Redirect URLs**, clique em **Add URL** e adicione as duas:
   - `https://musafit.me/primeiro-acesso`
   - `http://localhost:3000/primeiro-acesso`
3. **Save changes**. Não remova as URLs que já estão lá.

---

## 3. Templates de e-mail no Supabase — [Você]

Supabase → **Authentication** → **Email Templates**.

### 3.1 Magic Link (o e-mail novo de "acesso liberado")

1. Abra a aba **Magic Link**.
2. **Subject**: `Seu acesso à MusaFit está liberado`
3. Em **Message body** (modo código-fonte / HTML), apague tudo e cole o HTML abaixo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#F9EFEA;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9EFEA;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:24px;padding:32px;">
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <span style="font-size:28px;font-weight:700;color:#3B2A30;">Musa<span style="font-style:italic;font-weight:400;color:#C87F97;">Fit</span></span>
              </td>
            </tr>
            <tr>
              <td style="font-size:22px;font-weight:700;color:#3B2A30;padding-bottom:12px;" align="center">
                Seu acesso está liberado
              </td>
            </tr>
            <tr>
              <td style="font-size:16px;line-height:24px;color:#6B5A60;padding-bottom:28px;" align="center">
                Seu pagamento foi confirmado. Toque no botão abaixo para entrar na sua conta e criar a sua senha.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="{{ .ConfirmationURL }}"
                   style="display:inline-block;background:#DD98AF;background-image:linear-gradient(90deg,#E8A9BF,#C87F97);color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:700;padding:14px 32px;border-radius:999px;">
                  Acessar minha conta
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:20px;color:#9A8A90;" align="center">
                Se o botão não funcionar, copie e cole este endereço no navegador:<br>
                <span style="word-break:break-all;">{{ .ConfirmationURL }}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

4. Clique em **Save changes**.

> Dica: se os templates atuais (Reset Password, Confirm signup) usam cores ou fontes um pouco diferentes, pode ajustar as cores do HTML acima para ficar igual. O essencial é manter o botão com o texto **Acessar minha conta** e o link `{{ .ConfirmationURL }}` exatamente como está.

### 3.2 Assuntos dos outros templates (só o **Subject**, o corpo continua igual)

| Aba | Subject |
|---|---|
| Reset Password | `Redefinir sua senha` |
| Confirm signup | `Confirme seu e-mail` |
| Invite | `Você foi convidada para a MusaFit` |
| Change Email Address | `Confirme seu novo e-mail` |

Salve cada aba com **Save changes**.

---

## 4. Conferir que o login por telefone está DESLIGADO — [Você]

1. Supabase → **Authentication** → **Providers** → **Phone**.
2. O botão **Enable Phone provider** deve estar **desligado**.
3. Se estiver ligado, desligue e salve.

Motivo: um login por código no telefone seria contado como prova de e-mail, e não é.

---

## 5. Deploy do código (merge na main) — [Claude, com a sua autorização]

O Claude faz o merge da branch `feature/pay-first-checkout` na `main` e a Vercel publica.

Espere o deploy terminar (status **Ready** na Vercel) antes de ir para o passo 6.

---

## Antes do passo 6: confirme que trocar o e-mail pela conta não é possível — [Claude]

Depois de aplicar a migração (passo 0), o Claude confere no banco que a trava existe e funciona: tentar trocar o e-mail de uma conta de teste tem que dar o erro **"Troca de e-mail desativada"**, e o e-mail da conta tem que continuar o mesmo. Só siga para o passo 6 com essa confirmação.

---

## 6. SÓ DEPOIS do deploy: desligar "Confirm email" — [Você]

1. Supabase → **Authentication** → **Providers** → **Email**.
2. Desligue **Confirm email**.
3. **Save**.

Não faça isso antes do passo 5.

---

## 7. Landing page — [Claude, quando o repositório da landing for compartilhado]

Cada card de plano passa a apontar para:

- `https://musafit.me/comprar?plano=mensal`
- `https://musafit.me/comprar?plano=trimestral`
- `https://musafit.me/comprar?plano=semestral`
- `https://musafit.me/comprar?plano=anual`

E repassa os `utm_*` da URL da landing (por exemplo `?utm_source=instagram`) para o link do `/comprar`.

Só depois do passo 5 (deploy), para os links já apontarem para um `/comprar` que existe em produção.

Você não precisa fazer nada neste passo até compartilhar o repositório da landing.

**Conferir as UTMs (depois que o Claude trocar os links):** abra `https://<endereço da landing>/?utm_source=teste`, toque num card de plano e confira que a URL do `/comprar` ainda tem `utm_source=teste`.

---

## 8. Teste ponta a ponta em produção — [Você]

Use um e-mail de teste **novo** (que nunca teve conta) e que esteja na lista `CHECKOUT_TEST_EMAILS`.

**Teste A — conta nova (Pix de R$ 0,01)**

1. Abra `https://musafit.me/comprar?plano=teste` (de preferência no navegador do Instagram ou em janela anônima).
2. Digite o e-mail de teste e escolha **Pix**. Pague R$ 0,01.
3. Na tela de retorno, siga o aviso para entrar na conta.
4. Confira a caixa de entrada: deve chegar o e-mail **"Seu acesso à MusaFit está liberado"**.
5. Toque em **Acessar minha conta**. Deve abrir `https://musafit.me/primeiro-acesso`.
6. Crie uma senha (é obrigatória, não existe "pular").
7. Você deve cair no onboarding.

**Teste B — mesmo e-mail de novo (só credita)**

1. Depois de ter clicado no link do Teste A, abra de novo `https://musafit.me/comprar?plano=teste` com o **mesmo e-mail**.
2. Pague Pix de R$ 0,01.
3. O período deve ser creditado na conta e **nenhum e-mail novo** deve chegar.

**Teste C — cartão com valor real**

1. Abra `https://musafit.me/comprar?plano=mensal` com um e-mail seu.
2. Pague no cartão (teste o parcelamento até 12x aparecendo).
3. Confirme que a assinatura foi creditada.
4. Faça o **estorno** no painel do Mercado Pago (Atividades → o pagamento → **Devolver dinheiro**).

**Conferir o funil**

1. Entre com a conta de admin → **Admin** → card **Funil**.
2. Confirme que os testes aparecem (e-mail digitado, pagamento iniciado, aprovado) e a origem (utm) se houver.

---

## 9. Se algo der errado — como desfazer

- **Cadastro ou login quebrou depois do passo 6:** religue **Confirm email** (Supabase → Authentication → Providers → Email → **Confirm email** ligado → Save). Isso volta ao comportamento antigo na hora.
- **Landing page:** os cards voltam ao link antigo (o Claude reverte o commit do repositório da landing, ou você restaura o link anterior de cada card).
- **Código novo com problema:** avise o Claude para reverter o merge na `main` (a Vercel publica a versão anterior). **Ao mesmo tempo, e antes da reversão,** religue **Confirm email** (veja o item acima). Se o passo 6 já foi feito e o código voltar ao antigo com o "Confirm email" desligado, e-mails não verificados conseguem criar conta.
- Os e-mails/templates do Supabase (passo 3) são seguros de deixar como estão; não atrapalham o fluxo antigo.
- Não apague a migração do banco. As tabelas novas não interferem no fluxo antigo.
