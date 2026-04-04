# Sources

## Fonte principal

- Documentacao textual da API Paradise fornecida pelo usuario nesta sessao.

Cobertura documentada:
- guia de inicio rapido
- autenticacao por `X-API-Key`
- criacao de transacao PIX
- tracking UTM no create
- consulta por ID interno e por `external_id`
- seller
- refund
- webhook
- status
- codigos de erro

## Inconsistencias e limites observados

- A criacao retorna `transaction_id` e `id`, enquanto as consultas usam `external_id` para representar a referencia.
- O exemplo de webhook recebido tem erro de sintaxe JSON em `tracking`; usar os nomes de campos, nao a pontuacao literal.
- Nao foi documentada assinatura HMAC ou header oficial de verificacao do webhook.
- A documentacao nao expõe taxa de gateway para preencher comissao da UTMify.

## Inferencias operacionais usadas neste skill

- `pending`, `processing` e `under_review` foram agrupados como `waiting_payment` para UTMify.
- `failed` foi mapeado para `refused` na UTMify por equivalencia operacional, porque a documentacao Paradise agrupa falha, cancelamento e expiracao em um unico estado.
- `Purchase` em pixels deve ocorrer apenas apos `approved`, seguindo boa pratica de confirmacao real de pagamento.
- Tracking deve ser persistido no momento do create request, e nao reconstruido a partir do webhook.
