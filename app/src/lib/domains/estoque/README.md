# Domínio: Estoque e WMS

Depósitos, localizações, saldos, reservas, movimentações, recebimento,
picking, conferência, packing, expedição.

Núcleo central de negócio — regras críticas (reserva concorrente,
consistência de saldo) sempre no backend, nunca só no frontend. Não
depende de `comercial` nem de `integracoes`; é o inverso: comercial
consulta disponibilidade de estoque, e integrações escrevem
movimentações através daqui, nunca direto nas tabelas.

**Implementado na Etapa 3** (`stock.ts`): núcleo de reserva/liberação/
efetivação via funções do banco (`reserve_stock`, `release_reservation`,
`fulfill_reservation`) — concorrência via lock de linha, idempotência
via `idempotency_key`, auditoria automática em `audit_log`.
`inventory_levels`/`stock_reservations`/`stock_movements` são
somente-leitura pro cliente; toda escrita passa por essas funções.
Disponibilidade (`stock_availability`) é uma view calculada
(físico − reservado ativo), nunca uma coluna guardada.

**Não implementado ainda:** recebimento, picking, conferência, packing,
expedição (WMS operacional) — entram quando existir tela/fluxo real
usando o núcleo acima, não antes.
