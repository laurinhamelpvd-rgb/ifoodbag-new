# Testing and Troubleshooting

## Pre-requisitos

- Definir `PARADISE_API_KEY`
- Definir `BASE_URL=https://multi.paradisepags.com`
- Testar em ambiente seguro

Exemplo PowerShell:

```powershell
$env:PARADISE_API_KEY = "sk_sua_chave"
$env:BASE_URL = "https://multi.paradisepags.com"
```

## Preflight: validar seller

```bash
curl --location "$BASE_URL/api/v1/seller.php" \
  --header "X-API-Key: $PARADISE_API_KEY"
```

## Criar transacao

```bash
curl --location "$BASE_URL/api/v1/transaction.php" \
  --header "X-API-Key: $PARADISE_API_KEY" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "amount": 1000,
    "description": "Produto Teste",
    "reference": "PED-10001",
    "source": "api_externa",
    "customer": {
      "name": "Joao da Silva",
      "email": "joao@example.com",
      "phone": "11999999999",
      "document": "05531510101"
    },
    "tracking": {
      "utm_source": "facebook",
      "utm_campaign": "campanha_teste",
      "utm_medium": "cpc",
      "utm_content": "criativo_1",
      "utm_term": "feed",
      "src": "src_test",
      "sck": "sck_test"
    }
  }'
```

## Consultar por ID interno

```bash
curl --location "$BASE_URL/api/v1/query.php?action=get_transaction&id=158" \
  --header "X-API-Key: $PARADISE_API_KEY"
```

## Consultar por referencia

```bash
curl --location "$BASE_URL/api/v1/query.php?action=list_transactions&external_id=PED-10001" \
  --header "X-API-Key: $PARADISE_API_KEY"
```

## Refund

```bash
curl --location --request POST "$BASE_URL/api/v1/refund.php" \
  --header "X-API-Key: $PARADISE_API_KEY" \
  --header "Content-Type: application/json" \
  --data-raw '{
    "transaction_id": 158
  }'
```

## Exemplo PowerShell para create

```powershell
$headers = @{
  "X-API-Key" = $env:PARADISE_API_KEY
  "Content-Type" = "application/json"
}

$body = @{
  amount = 1000
  description = "Produto Teste"
  reference = "PED-10001"
  source = "api_externa"
  customer = @{
    name = "Joao da Silva"
    email = "joao@example.com"
    phone = "11999999999"
    document = "05531510101"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "$env:BASE_URL/api/v1/transaction.php" -Headers $headers -Body $body
```

## Checklist ponta a ponta

1. Validar seller com a mesma `X-API-Key` do ambiente.
2. Criar transacao e confirmar `transaction_id`, `id`, `qr_code` e `expires_at`.
3. Persistir tracking e IDs no banco.
4. Exibir QR/copia-e-cola no checkout.
5. Enviar `waiting_payment` para UTMify.
6. Confirmar webhook `approved` e liberar compra.
7. Enviar `paid` para UTMify e validar tracking no painel.
8. Reenviar o mesmo webhook para provar idempotencia.
9. Consultar a transacao por API e comparar com o estado local.
10. Testar refund de uma transacao aprovada.

## Erros comuns

`400 Bad Request`
- JSON invalido
- tipo incorreto
- campo obrigatorio ausente

Acao:
- validar schema antes do envio
- logar payload sanitizado

`401 Unauthorized`
- `X-API-Key` ausente ou invalida
- conta inativa

Acao:
- validar credencial no painel
- testar `seller.php`

`404 Not Found`
- endpoint incorreto
- transacao nao encontrada
- refund sem permissao

Acao:
- revisar URL
- confirmar `transaction_id`

`422 Unprocessable Entity`
- refund em transacao nao aprovada

Acao:
- consultar status antes do refund

`500 Internal Server Error`
- falha do provedor

Acao:
- aplicar retry com backoff
- registrar para reconciliacao

## Checklist de go-live

1. Segredo somente no backend.
2. Webhook com HTTPS e token secreto na URL.
3. Idempotencia habilitada.
4. Reconciliacao automatica para pedidos presos em pendencia.
5. Alertas de `failed`, `refunded` e `chargeback`.
6. UTMify recebendo `waiting_payment` e `paid` com o mesmo `orderId`.
