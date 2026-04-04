# Paradise API Contract (PIX)

## Sumario

- Base URL e autenticacao
- Criar transacao
- Consultar transacao
- Seller
- Refund
- Webhook
- Status e erros

## Base URL e autenticacao

- Base URL: `https://multi.paradisepags.com`
- Header obrigatorio:
  - `X-API-Key: sk_sua_chave`
- Header recomendado:
  - `Content-Type: application/json`

Usar autenticacao apenas no backend.

## Criar transacao

- Metodo: `POST /api/v1/transaction.php`
- Metodo de pagamento suportado pela documentacao recebida: `pix`

Campos principais:
- `amount` (integer, obrigatorio): valor em centavos.
- `description` (string, obrigatorio): nome do produto.
- `reference` (string, obrigatorio): identificador unico do pedido no sistema local.
- `postback_url` (string, opcional): webhook especifico da transacao.
- `productHash` (string, obrigatorio por padrao): hash do produto no painel Paradise.
- `source` (string, opcional): usar `api_externa` para ignorar validacao de `productHash`.
- `orderbump` (string ou array, opcional): hash unico ou lista de hashes de offers.
- `tracking` (object, opcional): `utm_*`, `src`, `sck`.
- `splits` (array, opcional): repasse para outros recebedores.
- `customer` (object, obrigatorio): dados do comprador.

`customer`:
- `name` (string, obrigatorio)
- `email` (string, obrigatorio)
- `document` (string, obrigatorio, apenas numeros)
- `phone` (string, obrigatorio, apenas numeros)

`tracking`:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `src`
- `sck`

`splits[]`:
- `recipientId` (integer, obrigatorio)
- `amount` (integer, obrigatorio, centavos)

Exemplo minimo:

```json
{
  "amount": 1000,
  "description": "Produto Teste",
  "reference": "PED-12345",
  "customer": {
    "name": "Joao da Silva",
    "email": "joao@teste.com",
    "phone": "11999999999",
    "document": "05531510101"
  },
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

Resposta de sucesso (resumo):
- `status`
- `transaction_id`
- `id`
- `qr_code`
- `qr_code_base64`
- `amount`
- `acquirer`
- `attempts`
- `expires_at`

Notas importantes:
- `transaction_id` e o ID numerico interno Paradise.
- `id` e o espelho do seu `reference`.
- Persistir ambos.
- Se o projeto usa catalogo externo, `source: "api_externa"` evita dependencia de `productHash`.

## Consultar transacao por ID interno

- Metodo: `GET /api/v1/query.php?action=get_transaction&id={transaction_id}`

Campos comuns:
- `id`
- `external_id`
- `status`
- `amount`
- `created_at`
- `updated_at`
- `acquirer_name`
- `customer_data`
- `attempts_data`
- `amount_in_reais`

## Consultar transacao por referencia

- Metodo: `GET /api/v1/query.php?action=list_transactions&external_id={reference}`
- Retorno: array, mesmo quando so existe um registro.

Campos comuns por item:
- `id`
- `external_id`
- `status`
- `amount`
- `created_at`
- `updated_at`
- `amount_in_reais`

## Seller

- Metodo: `GET /api/v1/seller.php`
- Objetivo: confirmar dados publicos da conta associada ao `X-API-Key`.

Campos comuns:
- `name`
- `company_name`
- `document`
- `email`
- `entity_type`

## Refund

- Metodo: `POST /api/v1/refund.php`
- Body:

```json
{
  "transaction_id": 158
}
```

Sucesso:

```json
{
  "success": true,
  "message": "Reembolso processado com sucesso."
}
```

Erros relevantes:
- `404` com `"Permissao negada."`
- `422` com `"Apenas transacoes aprovadas podem ser reembolsadas."`

## Webhook

Paradise envia POST para a URL configurada quando o status muda.

Campos observados:
- `transaction_id`
- `external_id`
- `status`
- `amount`
- `payment_method`
- `customer`
- `pix_code`
- `raw_status`
- `webhook_type`
- `timestamp`
- `tracking`

Observacoes:
- O exemplo textual recebido tem JSON de `tracking` sem algumas virgulas; tratar os nomes de campos como referencia sem copiar o erro de sintaxe.
- A documentacao nao informa assinatura criptografica do webhook.

## Status oficiais

- `pending`
- `approved`
- `processing`
- `under_review`
- `failed`
- `refunded`
- `chargeback`

## Codigos de erro

- `200 OK`: sucesso
- `400 Bad Request`: payload invalido ou faltando campo
- `401 Unauthorized`: API key ausente, invalida ou conta inativa
- `404 Not Found`: recurso inexistente
- `500 Internal Server Error`: erro no provedor

Observacao:
- O fluxo de refund tambem documenta `422`.
