# Webhook Operations

## Objetivo

Confirmar pagamento com confiabilidade sem aprovar compra em falso positivo.

## Contrato minimo esperado

Campos minimos para processar:
- `transaction_id`
- `external_id`
- `status`

Campos uteis adicionais:
- `amount`
- `payment_method`
- `timestamp`
- `customer`
- `pix_code`
- `raw_status`
- `tracking`

## Pipeline recomendado

1. Receber webhook em endpoint dedicado.
2. Validar payload minimo e ambiente.
3. Persistir payload bruto imediatamente.
4. Responder HTTP `200` rapido.
5. Enfileirar processamento assincrono.
6. Aplicar idempotencia antes de efeitos colaterais.
7. Atualizar transacao e pedido local.
8. Disparar integracoes derivadas apenas depois do commit:
- UTMify
- Pixel/CAPI
- liberacao de acesso
- fiscal/notificacoes

## Idempotencia

Chave recomendada:
- `paradise:{tenant}:{transaction_id}:{status}`

Fallback quando `tenant` nao existir:
- `paradise:{transaction_id}:{status}`

Comportamento:
- evento repetido deve ser tratado como sucesso idempotente
- nunca repetir side effects em webhook duplicado
- manter historico de duplicatas para diagnostico

## Regras de transicao

Estados documentados:
- `pending`
- `processing`
- `under_review`
- `approved`
- `failed`
- `refunded`
- `chargeback`

Regra recomendada:
- `pending -> approved`: aprovar compra
- `pending -> processing` ou `under_review`: manter aguardando
- `processing -> approved`: aprovar compra
- `approved -> refunded`: reverter beneficios conforme politica
- `approved -> chargeback`: sinalizar fraude/disputa e reverter acesso sensivel
- `failed`: encerrar como perda terminal

Evitar:
- regressao de `approved` para `pending`
- regressao de estados finais para estados intermediarios

## Seguranca operacional

Como a documentacao recebida nao detalha assinatura:
- exigir HTTPS
- usar URL com token secreto por ambiente
- limitar tamanho do body
- aplicar rate limit
- registrar IP/origem para investigacao

Nao assumir header HMAC ou assinatura proprietaria sem evidencia.

## Reconciliacao ativa

Consultar a API quando:
- webhook nao chegar dentro do SLA esperado
- webhook vier incompleto
- status local divergir do provider
- houver duvida sobre o significado de `failed` e for preciso inspecionar `raw_status` ou `attempts_data`

Endpoints uteis:
- `GET /api/v1/query.php?action=get_transaction&id={transaction_id}`
- `GET /api/v1/query.php?action=list_transactions&external_id={reference}`

## Politica para UTMify e analytics

- `waiting_payment` deve ser enviado uma vez no create ou no primeiro estado pendente.
- `processing` e `under_review` normalmente nao exigem novo envio para UTMify se o pedido ja esta em `waiting_payment`.
- `approved` deve acionar `paid`.
- `refunded` deve acionar `refunded`.
- `chargeback` deve acionar `chargedback`.
- `failed` pode acionar `refused` como inferencia operacional.

## Observabilidade minima

Metricas:
- volume de webhooks por status
- latencia de processamento
- tempo `pending -> approved`
- taxa de divergencia resolvida por reconciliacao
- taxa de duplicatas

Alertas:
- aumento anormal de `failed`
- pico de `chargeback`
- backlog de fila de webhook
- falhas repetidas de envio para UTMify
