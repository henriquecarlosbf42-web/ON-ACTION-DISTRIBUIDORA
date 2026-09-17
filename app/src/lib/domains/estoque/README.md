# Domínio: Estoque e WMS

Depósitos, localizações, saldos, reservas, movimentações, recebimento,
picking, conferência, packing, expedição.

Núcleo central de negócio — regras críticas (reserva concorrente,
consistência de saldo) sempre no backend, nunca só no frontend. Não
depende de `comercial` nem de `integracoes`; é o inverso: comercial
consulta disponibilidade de estoque, e integrações escrevem
movimentações através daqui, nunca direto nas tabelas.

Nada implementado ainda (Etapa 2 é só a fundação multi-tenant). As
tabelas já existem (ver `supabase/migrations`), mas sem serviços de
domínio ou telas ainda.
