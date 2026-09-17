# Domínio: Integrações externas

Mercado Livre, Shopee, identificadores externos, status de
sincronização, logs de integração.

Depende de `comercial` (pedidos/produtos) e `estoque` (movimentações),
nunca o contrário. Credenciais (`external_integrations.credentials`)
só são lidas por código server-side com `service_role` — nunca no
frontend, nunca num Client Component.

Nada implementado ainda — nenhuma integração real com Mercado Livre ou
Shopee existe nessa etapa. `sales_channels` e `external_integrations`
são só a estrutura de dados pra isso.
