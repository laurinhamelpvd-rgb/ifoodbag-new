---
name: paradise-pix
description: Integrar a API PIX da Paradise em sites, SaaS, ofertas e checkouts proprios com criacao e consulta de transacoes, seller, order bump, split, refund, webhooks, tracking UTM e sincronizacao com UTMify. Usar quando o usuario pedir implementacao, correcao, migracao, auditoria ou debug de pagamentos Paradise com foco em confirmacao confiavel de compra, reconciliacao de status e atribuicao de marketing.
---

# Paradise PIX

## Objetivo

Atuar como especialista em integracao Paradise para fluxos PIX confiaveis ponta a ponta:
- criar cobranca com payload valido e rastreavel
- exibir QR code e copia-e-cola sem expor segredos
- confirmar compra por webhook com idempotencia
- reconciliar divergencias por consulta
- estornar com seguranca
- sincronizar status e tracking com UTMify e pixels quando o projeto exigir

Nao inventar campos, headers de assinatura ou regras de status fora da documentacao recebida. Quando um mapeamento para UTMify nao estiver explicitamente descrito pela Paradise, tratar como inferencia operacional e deixar isso claro.

## Fluxo padrao de implementacao

1. Confirmar arquitetura e modelo de pedido.
- Identificar se o projeto e LP, oferta, checkout proprio, API ou SaaS multi-tenant.
- Definir `order_id` interno, `reference` unico, persistencia de status e correlacao por tenant.

2. Validar credenciais e conta.
- Usar `X-API-Key` apenas no backend.
- Validar conectividade e conta com `GET /api/v1/seller.php` antes de debug mais profundo.
- Isolar credencial por tenant e ambiente.

3. Implementar criacao da transacao PIX.
- Chamar `POST /api/v1/transaction.php`.
- Validar `amount` em centavos, `reference` unico e `customer` com apenas numeros em `document` e `phone`.
- Enviar `productHash` por padrao.
- Usar `source: "api_externa"` somente quando for intencional ignorar `productHash`.
- Incluir `tracking` sempre que houver UTMs/src/sck.
- Persistir `transaction_id` e `id` retornado pela Paradise.

4. Exibir instrucao de pagamento no frontend.
- Retornar ao browser apenas `qr_code`, `qr_code_base64`, `expires_at`, valor e identificadores nao sensiveis.
- Manter pedido local em estado pendente ate confirmacao real.

5. Processar webhook com resiliencia.
- Receber POST em endpoint dedicado.
- Responder `200` rapido.
- Persistir payload bruto.
- Aplicar idempotencia por `transaction_id + status`.
- Liberar compra apenas em `approved`.

6. Reconciliar status.
- Consultar `GET /api/v1/query.php?action=get_transaction&id={transaction_id}` quando webhook atrasar ou houver divergencia.
- Buscar por referencia em `list_transactions&external_id={reference}` quando o ID interno nao estiver disponivel.

7. Implementar refund com trilha de auditoria.
- Chamar `POST /api/v1/refund.php` com `transaction_id`.
- Permitir estorno apenas para transacoes aprovadas.
- Registrar motivo, operador e resultado da API.

8. Sincronizar analytics e atribuicao.
- Enviar `waiting_payment` para UTMify ao gerar PIX.
- Enviar `paid`, `refunded` ou `chargedback` conforme eventos finais.
- Tratar `failed -> refused` em UTMify como inferencia operacional, refinando com `raw_status` quando necessario.
- Disparar `Purchase` em Pixel/CAPI somente apos `approved`.

## Escolher referencias por tarefa

- Ler `references/api-contract.md` para contratos, campos, exemplos e nuances de IDs.
- Ler `references/playbooks.md` para padroes por arquitetura, modelagem e go-live.
- Ler `references/webhook-operations.md` para idempotencia, seguranca, reconciliacao e maquina de status.
- Ler `references/utmify-and-tracking.md` para UTMify, UTMs, Meta/TikTok e mapeamento Paradise -> analytics.
- Ler `references/testing-and-troubleshooting.md` para cURL, PowerShell, checklist e erros comuns.
- Ler `references/sources.md` para limites da documentacao e inferencias usadas.

## Regras obrigatorias

- Base URL: `https://multi.paradisepags.com`.
- Header obrigatorio em toda chamada server-side: `X-API-Key`.
- Nunca expor Secret Key no frontend.
- `amount` sempre em centavos.
- `reference` sempre unico e estavel por pedido.
- `productHash` e obrigatorio, exceto quando `source` for `api_externa`.
- Persistir `transaction_id` Paradise e o espelho de `reference`.
- Webhook e fonte principal de status; polling e fallback.
- Nao aprovar compra no retorno imediato da criacao.
- Nao assumir assinatura HMAC de webhook sem documentacao.
- Persistir tracking localmente no create request; nao depender do webhook para reconstruir UTMs.
- Aplicar retry com backoff apenas para timeout, rede e `5xx`.

## Politica minima de status

- `pending`, `processing`, `under_review`: ainda nao pago.
- `approved`: pago.
- `failed`: falha terminal, cancelamento ou expiracao.
- `refunded`: estornado.
- `chargeback`: contestado.

Se houver sincronizacao com UTMify:
- `pending`, `processing`, `under_review` -> `waiting_payment`
- `approved` -> `paid`
- `refunded` -> `refunded`
- `chargeback` -> `chargedback`
- `failed` -> `refused` como inferencia operacional; validar se `raw_status` ou regra interna permite granularidade maior

## Entregaveis minimos em tarefas reais

- endpoint backend para criar transacao PIX
- endpoint backend para webhook com idempotencia
- persistencia de `reference`, `transaction_id`, tracking e historico de status
- reconciliacao por consulta de transacao
- fluxo seguro de refund
- sincronizacao com UTMify quando exigida
- comandos de teste e checklist de validacao

## Integracao com outras skills

- Combinar com `utmify-integration` para contrato completo de pedidos e status na UTMify.
- Combinar com `meta-pixel-integration` para browser + CAPI mais confiavel.
- Combinar com `tiktok-pixel-integration` quando o funil exigir sinalizacao no TikTok.
