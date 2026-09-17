# Domínio: Comercial

Produtos, SKUs, categorias, clientes, tabelas de preço, pedidos, canais
de venda.

Depende de `domains/platform` (organização atual) e de `domains/estoque`
pra checar disponibilidade antes de confirmar um pedido — nunca o
contrário (estoque não deve depender de comercial).

Nada implementado ainda (Etapa 2 é só a fundação multi-tenant). As
tabelas já existem (ver `supabase/migrations`), mas sem serviços de
domínio ou telas ainda.
