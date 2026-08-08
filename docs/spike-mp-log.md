# Log do spike Mercado Pago — Fase M1

Registro de cada tentativa dos scripts em `scripts/spike-mp/`, conforme exigido pelas Tarefas M1.1–M1.3 do `docs/PLANO-MERCADOPAGO.md`. Sucesso e falha, sempre — é o que a Fase M2 usa para saber a diferença entre o que a documentação promete e o que a API do Mercado Pago realmente devolveu.

Formato por entrada: data, script, comando, resultado, o que foi aprendido.

---

## Estado em 2026-08-08 (antes de qualquer execução)

Preparação feita via MCP oficial do Mercado Pago (ver `docs/PLANO-MERCADOPAGO.md`, Registro de revisão 2):

- Aplicação `musaapp` (AppID `6869259522625752`) confirmada
- Credenciais de sandbox obtidas e gravadas em `.env.local`
- `MERCADOPAGO_WEBHOOK_SECRET` ainda **não existe** — nenhum webhook registrado
- Usuário de teste comprador existente desde julho (User ID `3549381055`), senha mascarada, pendente de reset pelo painel
- Hipótese antiga do blocker B (dataId vazio) **derrubada** antes mesmo de rodar o spike — ver script `03-verify-signature.mjs` para o raciocínio

Nenhum script foi executado ainda. Próxima entrada deve vir de uma execução real.

---

## 2026-08-08 — 01-create-preapproval.mjs

**Comando:** `node --env-file=.env.local scripts/spike-mp/01-create-preapproval.mjs comprador.teste.musa@example.com`

**Resultado:** falha (esperada — e informativa)

**Saída relevante:**
```json
{
  "message": "Both payer and collector must be real or test users",
  "status": 400
}
```

**Aprendizado:**

- Confirma o item 2 da ordem de investigação: com credenciais de sandbox, o Mercado Pago **exige que `payer_email` corresponda a um usuário de teste real** cadastrado no painel. Um e-mail arbitrário (mesmo sintaticamente válido, mesmo diferente do vendedor) é rejeitado antes de qualquer verificação de identidade pagador-vendedor.
- **Ainda não testa a hipótese A** (pagador = vendedor). Para isso, o próximo passo precisa do e-mail real do usuário de teste comprador (User ID `3549381055`, existente desde julho) — obter no painel, já que `create_test_user` via MCP só devolve usuário mascarado quando já existe.
- **Achado colateral, corrigido:** a chamada real ao SDK (`preApproval.create`) deixa um handle HTTP keep-alive fechando de forma assíncrona. Encerrar com `process.exit(1)` logo após o `catch` derruba o processo no Windows: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76`, com `EXIT: 127` (código enganoso — não é "comando não encontrado", é crash de baixo nível do libuv). Trocado por `process.exitCode = 1` em `01` e `02`, que deixa o event loop drenar antes de sair. Reproduzido de forma consistente antes da correção, ausente depois.

<!-- Próxima entrada:

## AAAA-MM-DD HH:MM — 01-create-preapproval.mjs

**Comando:** `node --env-file=.env.local scripts/spike-mp/01-create-preapproval.mjs <email>`

**Resultado:** sucesso | falha

**Saída relevante:**
```
(colar aqui)
```

**Aprendizado:**

-->
