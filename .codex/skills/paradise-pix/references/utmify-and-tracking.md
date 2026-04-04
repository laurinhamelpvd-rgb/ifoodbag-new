# UTMify and Tracking

## Sumario

- Captura e persistencia de tracking
- Paradise `tracking`
- Mapeamento Paradise -> UTMify
- Payloads base UTMify
- Pixel Meta e TikTok
- Regras de consistencia

## Captura e persistencia de tracking

Capturar no frontend e persistir no backend:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `src`
- `sck`

Regras:
- salvar junto do pedido antes de criar a cobranca
- reenviar os mesmos valores para Paradise e UTMify
- preencher campos ausentes com `null` ao montar o payload da UTMify
- nao depender do webhook da Paradise para recuperar UTMs

## Paradise `tracking`

Ao criar a transacao, replicar o tracking capturado:

```json
{
  "tracking": {
    "utm_source": "FB",
    "utm_campaign": "CAMPANHA_2|413591587909524",
    "utm_medium": "CONJUNTO_2|498046723566488",
    "utm_content": "ANUNCIO_2|504346051220592",
    "utm_term": "Instagram_Feed",
    "src": "valor_src_aqui",
    "sck": "valor_sck_aqui"
  }
}
```

## Mapeamento Paradise -> UTMify

Mapeamento recomendado:
- `pending` -> `waiting_payment`
- `processing` -> `waiting_payment`
- `under_review` -> `waiting_payment`
- `approved` -> `paid`
- `refunded` -> `refunded`
- `chargeback` -> `chargedback`
- `failed` -> `refused`

Importante:
- O mapeamento `failed -> refused` e uma inferencia operacional. A documentacao Paradise agrupa falha, cancelamento e expiracao em `failed`, entao usar `raw_status` e regra interna quando houver necessidade de maior precisao.

## Payload base UTMify: PIX gerado

```json
{
  "orderId": "PED-12345",
  "platform": "Paradise",
  "paymentMethod": "pix",
  "status": "waiting_payment",
  "createdAt": "2026-04-04 15:00:00",
  "approvedDate": null,
  "refundedAt": null,
  "customer": {
    "name": "Joao da Silva",
    "email": "joao@teste.com",
    "phone": "11999999999",
    "document": "05531510101",
    "country": "BR",
    "ip": "203.0.113.10"
  },
  "products": [
    {
      "id": "produto-principal",
      "name": "Produto Teste",
      "planId": null,
      "planName": null,
      "quantity": 1,
      "priceInCents": 1000
    }
  ],
  "trackingParameters": {
    "src": "valor_src_aqui",
    "sck": "valor_sck_aqui",
    "utm_source": "FB",
    "utm_campaign": "CAMPANHA_2|413591587909524",
    "utm_medium": "CONJUNTO_2|498046723566488",
    "utm_content": "ANUNCIO_2|504346051220592",
    "utm_term": "Instagram_Feed"
  },
  "commission": {
    "totalPriceInCents": 1000,
    "gatewayFeeInCents": 0,
    "userCommissionInCents": 1000,
    "currency": "BRL"
  },
  "isTest": false
}
```

Observacao:
- `gatewayFeeInCents` nao e exposto pela documentacao Paradise recebida. Preencher com valor real do seu ledger quando disponivel; usar `0` apenas como fallback consciente.

## Payload base UTMify: pagamento confirmado

```json
{
  "orderId": "PED-12345",
  "platform": "Paradise",
  "paymentMethod": "pix",
  "status": "paid",
  "createdAt": "2026-04-04 15:00:00",
  "approvedDate": "2026-04-04 15:07:21",
  "refundedAt": null
}
```

## Payload base UTMify: estorno e chargeback

`refunded`:

```json
{
  "orderId": "PED-12345",
  "platform": "Paradise",
  "paymentMethod": "pix",
  "status": "refunded",
  "createdAt": "2026-04-04 15:00:00",
  "approvedDate": "2026-04-04 15:07:21",
  "refundedAt": "2026-04-05 09:12:04"
}
```

`chargeback`:

```json
{
  "orderId": "PED-12345",
  "platform": "Paradise",
  "paymentMethod": "pix",
  "status": "chargedback",
  "createdAt": "2026-04-04 15:00:00",
  "approvedDate": "2026-04-04 15:07:21",
  "refundedAt": null
}
```

## Pixel Meta e TikTok

Pontos recomendados:
- abrir checkout: `InitiateCheckout`
- gerar PIX: `AddPaymentInfo`
- confirmar `approved`: `Purchase` no Meta e `CompletePayment` ou evento equivalente no TikTok

Regras:
- usar browser + backend quando o projeto tiver CAPI
- deduplicar com `event_id`
- disparar compra somente depois do webhook aprovado ou reconciliacao positiva

## Regras de consistencia

- Reutilizar o mesmo `orderId` e `createdAt` em toda atualizacao UTMify.
- Enviar datas em UTC no formato `YYYY-MM-DD HH:MM:SS`.
- `approvedDate` so deve existir depois de `approved`.
- `refundedAt` so deve existir depois de `refunded`.
- Se `failed` for enviado para UTMify, usar `refused` e registrar que isso foi inferido a partir da documentacao Paradise.
