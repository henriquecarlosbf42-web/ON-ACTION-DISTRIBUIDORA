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
`products`, `product_variants` (SKU), `orders`, `order_items`

**Global (não pertence a nenhuma organização):** `units`,
`sales_channels` (site, mercado_livre, shopee, manual — são *tipos* de
canal, a plataforma inteira usa os mesmos 4)

**Estoque (por organização):** `stock_locations`, `inventory_levels`,
`stock_reservations`, `stock_movements`

**Integrações (por organização):** `external_integrations`
(credenciais de ML/Shopee — sem policy de select/insert/update pra
usuários autenticados; só `service_role` acessa)

Módulos de CRM e WMS mais completos (funil de vendas, picking,
conferência, packing, expedição) ficam pra próxima etapa — a Etapa 2 só
estruturou os limites dos domínios (`lib/domains/*`), sem implementar
lógica de negócio.

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
│   │   │       ├── estoque/    #   idem
│   │   │       └── integracoes/#   idem
│   │   ├── proxy.ts            # refresh de sessão + redirect pra /login
│   │   │                       # (Next.js 16 renomeou "middleware" pra "proxy")
│   │   └── types/database.ts   # placeholder até gerar tipos reais
│   ├── scripts/test-tenant-isolation.mjs   # valida isolamento entre orgs
│   └── .env.local (não versionado) / .env.example
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 00000000000001_foundation.sql
│       └── 00000000000002_multi_tenant.sql
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

## Riscos e pendências

- [ ] Gerar tipos reais (`supabase gen types typescript --linked`) e
      substituir `src/types/database.ts` — os casts manuais
      (`as { data: X }`) em `page.tsx` e `domains/platform/organizations.ts`
      somem quando isso acontecer
- [ ] Papéis (`role` em `organization_members`) hoje só distinguem
      "é membro" pra leitura/escrita geral e "é admin" pra gerenciar
      membros — restrição fina por papel em cada domínio (ex: só
      "estoque" edita `stock_*`) fica pra quando os módulos existirem
- [ ] `audit_log` tem estrutura e RLS, mas nada escreve nele ainda —
      instrumentar quando as primeiras ações de negócio existirem
- [ ] Seletor de organização (UI): não existe — só importa quando
      houver um usuário com mais de uma membership de verdade
- [ ] Integração real com Mercado Livre e Shopee: não implementada.
      `sales_channels` e `external_integrations` são só a fundação de
      dados pra isso
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

## Não implementado nessa etapa (por escopo)

Catálogo digital, e-commerce B2C, portal B2B, CRM, WMS completo,
dashboards/relatórios, integrações ML/Shopee, seletor de organização,
restrição de RLS por papel. A Etapa 2 só entregou a fundação
multi-tenant (isolamento de dados + limites de domínio), conforme o
master prompt.
