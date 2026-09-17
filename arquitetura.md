# Arquitetura — ON ACTION DISTRIBUIDORA

> Fundação técnica, criada em 2026-09-16 a partir do master prompt do
> cliente. Documento vivo — atualizar conforme o sistema evoluir.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, RLS)
- **Hospedagem:** Vercel
- Gerenciador de pacotes: npm (padrão do restante do repo)

## Decisões de modelagem

**Multi-tenant desde a Etapa 2 (2026-09-16).** A decisão inicial da
Etapa 1 foi single-tenant; o Carlos trouxe um segundo master prompt no
mesmo dia pedindo arquitetura SaaS multi-tenant desde o início (uso
imediato só na ON ACTION, mas com possibilidade real de vender pra
outras distribuidoras depois). Como o banco ainda estava vazio (nunca
chegou a ser usado), a Etapa 2 reestruturou o schema em vez de
conviver com o modelo antigo — sem migração de dados porque não havia
dados. Ver `spec-mestre-etapa2.md`.

**`organization_id` denormalizado em toda tabela de negócio**, não só
via join com `orders` — RLS mais simples e mais rápida (comparação
direta em vez de subquery em toda policy). `units` e `sales_channels`
continuam globais (metadado de plataforma, não dado de uma organização
específica).

**`organization_members` substitui `profiles.organization_id`.**
`profiles` virou o perfil global do usuário (nome); a organização e o
papel (`role`) do usuário vivem em `organization_members`
(`organization_id + user_id + role`, único por par). Isso é o que
permite um usuário pertencer a mais de uma organização no futuro sem
reescrever nada.

**"Organização atual" (`getCurrentOrg`)** — como um usuário pode ter
mais de uma membership no futuro, existe `src/lib/auth/current-org.ts`
resolvendo qual organização está ativa. Hoje pega a primeira
membership (cada usuário só tem uma, na prática). Quando existir uma
segunda organização de verdade, é ali que entra um seletor de
organização — não antes, pra não construir UI que não tem uso ainda.

**Migrations são aditivas a partir de agora.** A Etapa 2 foi a última
vez que uma migration "reestruturou" em vez de só adicionar — só foi
seguro porque o banco estava vazio. Daqui pra frente, mudança de schema
= migration nova, nunca editar uma já aplicada.

**Projeto Supabase real:** `ON-ACTION-SITE+CRM+WMS` (ref
`dqcnhkzdtwxjfhzstrmm`), criado e linkado. Não existe mais estado
"sem projeto" — isso já foi resolvido.

**Etapa 3 (2026-09-16) — núcleo de estoque escreve só via função.**
`inventory_levels`, `stock_reservations` e `stock_movements` viraram
somente-leitura pro cliente (`select` apenas na RLS). Toda escrita
passa por `reserve_stock()` / `release_reservation()` /
`fulfill_reservation()` — funções `security definer` que fazem lock de
linha (concorrência), checam `idempotency_key` (retry seguro) e gravam
em `audit_log` na mesma transação. Isso vale a partir de agora como
padrão pra qualquer dado crítico: se duas requisições simultâneas
puderem corromper o dado, a regra vai pra função no banco, não pro
código do app. Ver `spec-mestre-etapa3.md`.

**Etapa 4 (2026-09-16) — hierarquia organização → filial → depósito →
localização.** `stock_locations` (nome mantido de propósito, é a mesma
tabela que `reserve_stock`/`fulfill_reservation` já usam desde a Etapa
3 — trocar de nome quebraria as funções sem necessidade) ganhou
endereço (rua/coluna/nível), capacidade (dimensões + volume calculado
+ **volume útil configurado manualmente**, nunca inferido da geometria)
e um `warehouse_id` obrigatório. `branches` e `warehouses` são novas.

**`organization_id` de `warehouses`/`stock_locations` é derivado por
trigger**, não aceito do cliente — a etapa pedia explicitamente
"proteção contra acesso cruzado" e "validação de filial e depósito";
deixar esse campo gravável direto seria um jeito de uma organização
mal-intencionada anexar um depósito à conta de outra. `branches` (raiz
da hierarquia, sem pai) continua usando só a RLS normal
(`is_org_member`), não precisa de trigger.

**Corrigido:** `product_variants.sku` era único *globalmente* desde a
Etapa 1 — bug de multi-tenant que ninguém tinha notado (dois clientes
não conseguiriam usar o mesmo SKU). Virou único por organização. Ver
`spec-mestre-etapa4.md`.

## Modelo conceitual

Ver `supabase/migrations/00000000000001_foundation.sql` (Etapa 1) +
`00000000000002_multi_tenant.sql` (Etapa 2 — ler as duas juntas, a
segunda altera a primeira).

**Plataforma (multi-tenant):**
- `organizations` — cada distribuidora cliente do SaaS
- `profiles` — perfil global do usuário (nome), sem organização fixa
- `organization_members` — a membership de verdade: `organization_id +
  user_id + role` (admin/vendas/estoque/financeiro)
- `audit_log` — estrutura pronta (organização, ator, ação, entidade),
  instrumentação (o quê loga o quê) fica pra quando os módulos
  existirem

**Comercial (por organização):** `customers` (b2b/b2c), `categories`,
`products`, `product_variants` (SKU único por org, `barcode`,
dimensões/peso), `orders`, `order_items`

**Global (não pertence a nenhuma organização):** `units`,
`sales_channels` (site, mercado_livre, shopee, manual — são *tipos* de
canal, a plataforma inteira usa os mesmos 4)

**Estoque (por organização):** `branches` → `warehouses` →
`stock_locations` (endereço `rua/coluna/nivel` + `full_code` gerado,
capacidade `volume_total_m3` calculado + `volume_util_m3` manual +
`max_weight_kg`) → `inventory_levels`, `stock_reservations` (+
`status`, `idempotency_key`), `stock_movements` (+ `idempotency_key`,
`reservation_id`). `location_types` é configurável por organização
(picking, pulmão, doca...), não uma lista fixa da plataforma.
`stock_availability` é uma *view* (não tabela) — físico − reservado
ativo, calculada, nunca guardada.

**Desenhado na Etapa 4, não implementado ainda** (sem consumidor real
— nenhuma tela/fluxo usando endereço de verdade): `picking_waves` +
`picking_wave_orders` + `picking_tasks` + `picking_task_items`
(onda → pedido → tarefa por localização); `replenishment_tasks` +
`min_quantity`/`max_quantity` por localização; `inventory_sessions` +
`inventory_counts` + `inventory_adjustments` (contagem por código de
barras, ajuste sempre via função que gera `stock_movements`, nunca
sobrescreve saldo direto); `stock_transfers` + `stock_transfer_items`
(sempre duas pernas — saída da origem, entrada no destino — nunca um
único UPDATE).

**Integrações (por organização):** `external_integrations`
(credenciais de ML/Shopee — sem policy de select/insert/update pra
usuários autenticados; só `service_role` acessa), `external_references`
(mapeia produto/pedido interno ↔ ID externo do canal),
`integration_sync_logs` (idempotência, tentativa, status, erro —
histórico de sincronização). As duas novas também são somente-leitura
pro cliente.

Módulos de CRM e WMS operacional (recebimento, picking, conferência,
packing, expedição), IA/slotting e dashboards ficam pra próxima etapa —
a Etapa 3 entregou o núcleo de estoque e a fundação de integrações;
CRM/WMS/IA/dashboards ainda são só limites de domínio documentados
(`lib/domains/*`), sem tabela nem lógica própria.

## Estrutura de pastas

```
projetos/ON-ACTION-DISTRIBUIDORA/
├── app/                        # Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/          # área autenticada (shell + painel)
│   │   │   └── login/          # login público
│   │   ├── components/         # componentes reutilizáveis
│   │   ├── lib/
│   │   │   ├── supabase/       # clients (browser, server, proxy)
│   │   │   ├── auth/current-org.ts   # organização ativa do usuário
│   │   │   └── domains/        # limites de domínio (platform
│   │   │       ├── platform/   #   implementado nessa etapa)
│   │   │       ├── comercial/  #   só README, sem lógica ainda
│   │   │       ├── estoque/    #   stock.ts + locations.ts implementados
│   │   │       └── integracoes/#   só README, sem lógica ainda
│   │   ├── proxy.ts            # refresh de sessão + redirect pra /login
│   │   │                       # (Next.js 16 renomeou "middleware" pra "proxy")
│   │   └── types/database.ts   # placeholder até gerar tipos reais
│   ├── scripts/
│   │   ├── test-tenant-isolation.mjs    # valida isolamento entre orgs
│   │   ├── test-stock-core.mjs          # valida concorrência/idempotência
│   │   └── test-location-hierarchy.mjs  # valida hierarquia + trigger de segurança
│   └── .env.local (não versionado) / .env.example
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 00000000000001_foundation.sql
│       ├── 00000000000002_multi_tenant.sql
│       ├── 00000000000003_stock_core.sql
│       └── 00000000000004_estoque_localizacao.sql
├── site/ proposta/ conteudo/ ads/   # entregas não-técnicas do projeto
├── briefing.md
└── CLAUDE.md
```

## Segurança

- RLS habilitada em toda tabela de negócio, isolada por
  `organization_id` via a função `is_org_member(org_id)`
- `external_integrations.credentials` nunca é lido por `anon`/
  `authenticated` — sem policy = acesso negado por padrão
- `audit_log` só é escrito por `service_role` — sem policy de
  insert/update/delete pra usuários autenticados
- `SUPABASE_SERVICE_ROLE_KEY` só em `.env.local` (não versionado) e em
  variável de ambiente server-side, nunca com prefixo `NEXT_PUBLIC_`
- Sessão de auth renovada via `src/proxy.ts` (Next.js 16; equivalente ao
  antigo `middleware.ts`)
- Isolamento entre organizações validado por script automatizado (ver
  Validação abaixo), não só por inspeção manual das policies
- `inventory_levels`/`stock_reservations`/`stock_movements`: nenhuma
  escrita direta pra `authenticated`, só via `reserve_stock()` /
  `release_reservation()` / `fulfill_reservation()` (security definer,
  grant explícito só pra `authenticated`, `anon` sem acesso)
- Concorrência (lock de linha) e idempotência (`idempotency_key`)
  validadas por script automatizado, não só por leitura do SQL
- `organization_id` de `warehouses`/`stock_locations` é derivado por
  trigger a partir do pai (`branch_id`/`warehouse_id`) — um valor
  malicioso enviado pelo cliente é sobrescrito antes do RLS avaliar,
  validado por script automatizado (`test-location-hierarchy.mjs`)

## Riscos e pendências

- [ ] Gerar tipos reais (`supabase gen types typescript --linked`) e
      substituir `src/types/database.ts` — os casts manuais
      (`as { data: X }`) somem quando isso acontecer
- [ ] Papéis (`role` em `organization_members`) hoje só distinguem
      "é membro" pra leitura/escrita geral e "é admin" pra gerenciar
      membros — restrição fina por papel em cada domínio (ex: só
      "estoque" chama `fulfill_reservation`) fica pra quando os módulos
      existirem
- [ ] `audit_log` instrumentado só pras 3 ações do núcleo de estoque
      (reserve/release/fulfill) — outras ações de negócio (pedido
      criado, cliente editado) ainda não logam nada
- [ ] Seletor de organização (UI): não existe — só importa quando
      houver um usuário com mais de uma membership de verdade
- [ ] Integração real com Mercado Livre e Shopee: não implementada.
      `external_references`/`integration_sync_logs` são só a estrutura
      de mapeamento e log — nenhuma chamada real às APIs foi feita nem
      documentação oficial consultada ainda
- [ ] WMS operacional (recebimento/picking/conferência/packing/
      expedição), IA de slotting e dashboards: não existem — dependem
      de fluxo real de uso do núcleo de estoque primeiro
- [ ] Planos/assinaturas: desenho é `plans` + `organization_subscriptions`,
      mas sem modelo de cobrança definido as tabelas nem foram criadas
- [ ] Picking por onda, reabastecimento, inventário com coletor e
      transferências entre filiais: desenhados em `arquitetura.md`
      (seção Modelo conceitual), nenhuma tabela criada ainda — sem
      endereço real cadastrado, não tem o que testar
- [ ] `location_types` existe mas nenhum tipo foi cadastrado ainda —
      é o Carlos quem configura (picking/pulmão/doca), não é seed da
      plataforma
- [ ] Deploy na Vercel: não configurado ainda

## Validação

**Etapa 1 (2026-09-16):** `npm run lint` e `npm run build` sem erros
(Next.js 16.3.5, Turbopack).

**Etapa 2 (2026-09-16):** lint e build sem erros novamente após a
reestruturação multi-tenant. Isolamento entre organizações validado
com `app/scripts/test-tenant-isolation.mjs` — cria 2 organizações + 2
usuários reais no Supabase, confirma que um não lê dado do outro (nem
`customers` nem `organizations`), e limpa tudo depois. Rodar de novo
com `node scripts/test-tenant-isolation.mjs` sempre que a RLS mudar.

Organização real criada pro Carlos usar: **ON ACTION Distribuidora**
(`admin@onaction.com.br`, papel `admin`).

**Etapa 3 (2026-09-16):** lint e build sem erros após o núcleo de
estoque. `app/scripts/test-stock-core.mjs` cria organização + produto +
saldo reais e valida 3 regras críticas: (1) idempotência — duas
chamadas com a mesma `idempotency_key` retornam a mesma reserva; (2)
concorrência — duas reservas simultâneas concorrendo pelo mesmo saldo
resultam em exatamente uma sucesso e uma falha (nunca duas sucessos
vendendo em dobro); (3) efetivação — baixa o físico corretamente e
gera a movimentação. Isolamento entre organizações re-validado depois
da mudança de RLS (`test-tenant-isolation.mjs`, continua 3/3).

**Etapa 4 (2026-09-16):** lint e build sem erros após a hierarquia de
localização. `test-stock-core.mjs` re-executado do zero (agora criando
filial+depósito antes da localização) — continua 3/3. Novo
`test-location-hierarchy.mjs` valida 4 pontos: (1) código de filial
único por organização; (2) mesmo código em organizações diferentes não
colide; (3) `organization_id` malicioso enviado num INSERT de
`warehouse` é ignorado — o trigger deriva o valor certo a partir do
`branch_id` real; (4) isolamento entre organizações em `branches` e
`warehouses`. 4/4.

## Não implementado nessa etapa (por escopo)

**Etapa 2:** Catálogo digital, e-commerce B2C, portal B2B, CRM, WMS
completo, dashboards/relatórios, integrações ML/Shopee, seletor de
organização, restrição de RLS por papel.

**Etapa 3:** WMS operacional (recebimento/picking/conferência/packing/
expedição — sem tela/fluxo real ainda, construir agora seria estrutura
sem uso), IA/slotting (motor de cálculo — só o desenho do fluxo
pending→approved→executed foi pensado, tabela não criada), dashboards
(dependem de eventos de WMS que não existem), planos/assinaturas
(modelo de cobrança não definido), chamada real a Mercado Livre/Shopee
(sem endpoint inventado sem checar documentação oficial).

**Etapa 4:** picking por onda, reabastecimento, inventário com coletor
de código de barras, transferências entre filiais/depósitos — as 4
famílias de tabela estão desenhadas no Modelo conceitual acima, mas
nenhuma foi criada: todas dependem de endereço/localização real
existindo primeiro, e a etapa pediu explicitamente pra não construir o
WMS inteiro de uma vez.
