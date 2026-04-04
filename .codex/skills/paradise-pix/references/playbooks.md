# Playbooks de Integracao

## Sumario

- Playbook A: preflight e modelagem
- Playbook B: checkout proprio
- Playbook C: LP/oferta
- Playbook D: SaaS multi-tenant
- Playbook E: order bump e split
- Playbook F: UTMify e atribuicao
- Playbook G: modelo de dados

## Playbook A: preflight e modelagem

1. Validar credencial com `GET /api/v1/seller.php`.
2. Definir `order_id` interno e `reference` unico.
3. Escolher tabela ou colecao para:
- pedidos
- transacoes Paradise
- eventos de webhook
- logs de sincronizacao com UTMify
4. Definir estrategia de idempotencia:
- criacao: `reference`
- webhook: `transaction_id + status`
- UTMify: `orderId + status`

## Playbook B: checkout proprio

Fluxo recomendado:
1. Criar pedido interno com status `pending`.
2. Capturar e persistir UTMs/src/sck antes da chamada ao gateway.
3. Montar payload Paradise e chamar `POST /api/v1/transaction.php`.
4. Salvar `transaction_id`, `id`, `qr_code`, `expires_at`, status inicial e payload sanitizado.
5. Exibir QR/copia-e-cola no frontend.
6. Enviar `waiting_payment` para UTMify se a stack exigir.
7. Confirmar pedido como pago apenas com webhook `approved`.
8. Em divergencia, consultar `get_transaction`.

Boas praticas:
- timeout HTTP entre 8s e 15s.
- retry com backoff apenas em rede/timeout/`5xx`.
- logs com `order_id`, `reference` e `transaction_id`.

## Playbook C: LP/oferta

Fluxo recomendado:
1. Criar endpoint backend `/api/payments/paradise/create`.
2. Coletar nome, email, documento, telefone e tracking no frontend.
3. Chamar Paradise somente no backend.
4. Retornar ao browser apenas dados necessarios para UI.
5. Exibir tela de aguardando pagamento.
6. Atualizar UI por polling do backend ou websocket interno, nunca pelo frontend falando direto com Paradise.

Riscos comuns:
- aprovar compra ao criar o PIX
- nao persistir `transaction_id`
- depender de webhook para recuperar tracking

## Playbook D: SaaS multi-tenant

Fluxo recomendado:
1. Guardar `X-API-Key` por tenant com criptografia.
2. Resolver credencial correta pelo contexto do pedido.
3. Gerar `reference` unico por tenant.
4. Incluir `tenant_id` na correlacao de logs e idempotencia.
5. Isolar processamento de webhook por tenant.

Hardening minimo:
- rotacao de credenciais
- mascaramento de documentos/telefones em logs
- dead-letter queue para falhas persistentes
- dashboard por tenant para pedidos pendentes e divergentes

## Playbook E: order bump e split

Order bump:
1. Montar `orderbump` como hash unico ou array de hashes.
2. Validar existencia dos hashes no contexto do funil.
3. Persistir os order bumps selecionados no pedido interno.

Split:
1. Montar `splits[]` somente quando houver divisao real.
2. Validar `recipientId` e `amount` em centavos.
3. Garantir que a soma nao ultrapasse o total da venda.
4. Registrar regra de negocio da divisao fora do payload para auditoria.

Observacao:
- Pela documentacao recebida, a taxa da plataforma e descontada integralmente da conta principal.

## Playbook F: UTMify e atribuicao

Fluxo recomendado:
1. Salvar localmente `utm_*`, `src`, `sck` no create request.
2. Enviar Paradise `tracking` com os mesmos valores.
3. Ao gerar o PIX, enviar `waiting_payment` para UTMify.
4. Ao receber `approved`, enviar `paid`.
5. Ao receber `refunded`, enviar `refunded`.
6. Ao receber `chargeback`, enviar `chargedback`.
7. Ao receber `failed`, enviar `refused` apenas se o projeto quiser rastrear perda terminal; isso e inferencia operacional da doc.

Regra forte:
- Reutilizar o mesmo `orderId` e `createdAt` em todos os updates para UTMify.

## Playbook G: modelo de dados

Tabela `orders`:
- `id`
- `tenant_id`
- `reference`
- `status`
- `amount_cents`
- `product_name`
- `customer_name`
- `customer_email`
- `customer_document`
- `customer_phone`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `src`
- `sck`
- `created_at`
- `updated_at`

Tabela `payment_transactions`:
- `id`
- `provider`
- `order_id`
- `provider_transaction_id`
- `provider_external_id`
- `status_raw`
- `status_normalized`
- `qr_code`
- `qr_code_base64`
- `expires_at`
- `created_at`
- `updated_at`

Tabela `webhook_events`:
- `id`
- `provider`
- `provider_transaction_id`
- `provider_external_id`
- `status`
- `payload_json`
- `processed_at`
- `processing_status`

Tabela `analytics_dispatches`:
- `id`
- `order_id`
- `destination`
- `status_sent`
- `request_json`
- `response_json`
- `attempt_count`
- `last_attempt_at`
