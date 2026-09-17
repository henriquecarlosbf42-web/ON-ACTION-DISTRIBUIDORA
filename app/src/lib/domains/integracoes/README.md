# Domínio: Integrações externas

Mercado Livre, Shopee, identificadores externos, status de
sincronização, logs de integração.

Depende de `comercial` (pedidos/produtos) e `estoque` (movimentações),
nunca o contrário. Credenciais (`external_integrations.credentials`)
só são lidas por código server-side com `service_role` — nunca no
frontend, nunca num Client Component.

Nada implementado ainda — nenhuma integração real com Mercado Livre ou
Shopee existe nessa etapa. Não inventar endpoint sem checar a
documentação oficial quando chegar a hora.

**Estrutura pronta na Etapa 3** (sem chamada real ainda):
`external_references` (mapeia produto/pedido interno ↔ ID externo do
canal) e `integration_sync_logs` (idempotência, tentativa, status,
reconciliação). As duas são somente-leitura pro cliente — quem escreve
é o processo de sincronização (server-side, `service_role`), quando
ele existir.
