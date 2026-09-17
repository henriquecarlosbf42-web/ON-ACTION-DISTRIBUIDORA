# PROMPT MASTER — SAAS MULTIEMPRESA (site + catálogo + e-commerce + WMS + marketplaces)

> Criado em 2026-09-17 a pedido do Carlos. Este documento substitui o uso
> avulso de `spec-mestre-etapa5.md`, `-etapa6.md` etc.: a partir de agora,
> o roadmap inteiro fica num lugar só, dividido em etapas com checklist,
> pra dar pra acompanhar o que já foi feito sem precisar abrir vários
> arquivos. `spec-mestre.md` + `spec-mestre-etapa2.md` a `-etapa4.md`
> continuam valendo como histórico das Etapas 1–4 (já concluídas — ver
> `arquitetura.md`). Este arquivo assume o relato a partir da Etapa 5.

## Como usar este documento

- Cada Etapa abaixo é um prompt completo — dá pra copiar a seção da
  Etapa e colar direto numa sessão do Claude Code pra executar aquela
  fase.
- Execute as etapas em ordem. Cada uma depende de pelo menos uma
  anterior estar concluída (a dependência está listada em cada etapa).
- Ao concluir e validar uma etapa (lint + build + testes passando,
  conforme o Processo de Execução), marque o `[ ]` como `[x]` **e**
  atualize `arquitetura.md` com o que foi de fato implementado — o
  checklist aqui é o resumo rápido, `arquitetura.md` é o registro
  detalhado (essa divisão de responsabilidade já é como o projeto
  funciona desde a Etapa 1).
- Não pule etapa. Se uma etapa expõe uma decisão que só o Carlos pode
  tomar (ex: gateway de pagamento, modelo de cobrança do SaaS), ela
  fica marcada como "🔸 decisão pendente" dentro da etapa — resolver
  isso é pré-requisito pra concluir a etapa, não pra pular ela.

## Checklist geral de progresso

- [x] **Etapa 1** — Fundação técnica (Next.js + Supabase + Auth + RLS) — 2026-09-16
- [x] **Etapa 2** — Multi-tenant por organização (`organizations`, `organization_members`) — 2026-09-16
- [x] **Etapa 3** — Núcleo de estoque transacional (reserva/liberação/efetivação, idempotência, concorrência) — 2026-09-16
- [x] **Etapa 4** — Hierarquia de localização (filial → depósito → localização, capacidade cúbica, SKU único por org) — 2026-09-16
- [ ] **Etapa 5** — Multiempresa por domínio (cada empresa com seu domínio/subdomínio + branding)
- [ ] **Etapa 6** — Catálogo digital (produtos públicos, categorias, busca, imagens)
- [ ] **Etapa 7** — E-commerce B2C (carrinho, checkout, pagamento, pedido, área do cliente)
- [ ] **Etapa 8** — Portal B2B (login de empresa cliente, tabela de preço diferenciada, pedido por atacado)
- [ ] **Etapa 9** — CRM (funil, histórico de interação, tarefas)
- [ ] **Etapa 10** — WMS operacional (recebimento, picking por onda, conferência, packing, expedição, inventário, transferências)
- [ ] **Etapa 11** — Integração Mercado Livre (catálogo, pedidos, estoque, webhooks)
- [ ] **Etapa 12** — Integração Shopee (catálogo, pedidos, estoque, webhooks)
- [ ] **Etapa 13** — Dashboards e relatórios (vendas por canal, giro de estoque, performance)
- [ ] **Etapa 14** — Onboarding de nova empresa (replicar a base estrutural inteira pra um cliente novo do SaaS)

## Visão geral: arquitetura multiempresa por domínio

Isso vale pra todas as etapas abaixo, não só a Etapa 5 — é o contrato
que todo módulo novo precisa respeitar:

- **Um código só, N empresas.** Não existe "copiar o projeto pra cada
  cliente". Toda empresa nova roda no mesmo deploy, mesmo banco, mesmo
  código — isolada por `organization_id` (já implementado desde a
  Etapa 2) e resolvida por domínio (Etapa 5 implementa a resolução;
  Etapa 14 implementa como uma empresa nova entra nesse modelo sem
  trabalho manual).
- **Domínio → organização.** Cada organização tem um domínio próprio
  (domínio customizado, tipo `onaction.com.br`) ou um subdomínio da
  plataforma (tipo `onaction.nomedosaas.com.br`). A resolução acontece
  no proxy/middleware, antes de qualquer query — a organização "ativa"
  da requisição vem do `Host`, não de sessão nem de escolha manual do
  usuário (isso é diferente do `getCurrentOrg` que já existe pra
  membership de usuário logado — ver `arquitetura.md`; os dois
  conceitos convivem: domínio decide **qual empresa** o visitante está
  vendo, membership decide **o que aquele usuário logado pode fazer**
  dentro dela).
- **Base estrutural replicada, não o código.** "Replicar a base pra
  cada empresa" significa: toda empresa nova ganha automaticamente as
  mesmas tabelas, os mesmos módulos (catálogo, ecommerce, WMS, CRM,
  integrações) e a mesma UI — só os *dados* são diferentes e
  isolados. Nenhum módulo pode ser implementado assumindo que só existe
  uma empresa no sistema.
- **Branding por organização.** Logo, nome fantasia e cor primária são
  dados da organização (não do código) — quem visita o domínio de uma
  empresa vê a marca dela, não a da plataforma.
- **Nenhum módulo novo pode vazar dado entre organizações.** Todo
  módulo das etapas 6–13 herda a obrigação de RLS por
  `organization_id` que já é o padrão do projeto — isso não se repete
  em cada etapa abaixo pra não poluir, mas vale pra todas.

---

## Processo de execução (vale pra toda etapa abaixo)

FASE A — INSPEÇÃO: analisar o que já existe (migrations, componentes,
domínios já implementados), identificar dependências da etapa,
apresentar diagnóstico antes de mexer em código.

FASE B — PLANEJAMENTO: apresentar arquitetura da etapa, tabelas/rotas/
componentes que serão criados ou alterados, riscos técnicos e decisões
que precisam do Carlos. Esperar aprovação antes da Fase C.

FASE C — IMPLEMENTAÇÃO: em entregas pequenas, sem substituir
funcionalidade existente sem justificar, sem duplicar lógica.

FASE D — VALIDAÇÃO: lint, build, testes (criar script de validação
automatizado quando envolver regra crítica — é o padrão usado desde a
Etapa 2 pra isolamento entre organizações e desde a Etapa 3 pra
concorrência/idempotência). Só marcar o checklist como concluído depois
da Fase D passar.

Regras que valem pra todas as etapas (herdadas de `spec-mestre.md`):
não inventar integração que não foi implementada de verdade; não usar
dado fictício como se fosse produção; não declarar algo concluído sem
validar; não apagar código existente sem justificativa; não duplicar
tabela pro mesmo conceito; não colocar regra crítica de estoque só no
frontend; nenhuma credencial de marketplace exposta no frontend.

---

## Etapa 5 — Multiempresa por domínio

**Depende de:** Etapa 2 (multi-tenant por organização).

**Objetivo:** cada organização passa a ser acessível pelo próprio
domínio ou subdomínio, com resolução automática e branding próprio —
sem duplicar código.

Escopo:

- [ ] Campos de domínio na organização (domínio customizado e/ou
      subdomínio da plataforma — decidir se são exclusivos ou os dois
      coexistem por organização)
- [ ] Resolução da organização a partir do `Host` no proxy/middleware,
      antes de qualquer página renderizar
- [ ] Fallback claro pra domínio não cadastrado ("empresa não
      encontrada", não erro genérico)
- [ ] Comportamento correto em `localhost`/preview da Vercel durante
      desenvolvimento (não pode travar o ambiente de dev)
- [ ] Branding por organização: logo, nome fantasia, cor primária —
      aplicado no layout de toda página pública daquela organização
- [ ] 🔸 decisão pendente: domínio customizado exige configuração
      manual de DNS/SSL na Vercel por empresa — documentar o passo a
      passo pro Carlos, não tentar automatizar provisionamento de
      domínio nesta etapa
- [ ] Teste automatizado: domínio A nunca resolve pra organização B,
      mesmo com URL manipulada manualmente

---

## Etapa 6 — Catálogo digital

**Depende de:** Etapa 5 (site por domínio), Etapa 1 (produtos/SKUs já
existem no schema).

**Objetivo:** catálogo público de produtos por organização — navegável,
buscável, sem exigir login.

Escopo:

- [ ] Páginas públicas de categoria e produto, dentro do domínio da
      organização
- [ ] Busca e filtro (categoria, atributo, disponibilidade)
- [ ] Imagens de produto (Supabase Storage, isolado por organização)
- [ ] Exibição de disponibilidade usando a *view* `stock_availability`
      já existente (nunca calcular disponibilidade de novo no frontend)
- [ ] 🔸 decisão pendente: preço exibido no catálogo público é o preço
      B2C, o preço B2B fica só depois de login (Etapa 8)? Definir antes
      de implementar a página de produto
- [ ] SEO básico por organização (title/description dinâmicos por
      domínio, não fixos da plataforma)
- [ ] Estado vazio, de carregamento e de erro (catálogo sem produtos
      ainda não pode quebrar a página)

---

## Etapa 7 — E-commerce B2C

**Depende de:** Etapa 6 (catálogo), Etapa 3 (núcleo de estoque).

**Objetivo:** compra completa pelo consumidor final, do carrinho até a
confirmação do pedido.

Escopo:

- [ ] Carrinho (client-side, sem reservar estoque ainda)
- [ ] Checkout: reserva de estoque via `reserve_stock()` no início do
      checkout (nunca decrementar saldo direto)
- [ ] 🔸 decisão pendente: gateway de pagamento (qual provedor?) —
      bloqueia o checkout real; sem isso, implementar o fluxo até a
      criação do pedido e deixar o pagamento como próximo passo
      explícito, não simulado como se funcionasse
- [ ] Criação de `order` + `order_items` no canal `site` (já existe
      como `sales_channel` global)
- [ ] Liberação automática da reserva se o checkout expira sem
      pagamento (usa `release_reservation()`)
- [ ] E-mail transacional de confirmação de pedido
- [ ] Área do cliente: histórico de pedidos, status
- [ ] Teste de concorrência: dois checkouts simultâneos pelo último
      item do estoque — exatamente um sucede (reaproveita a validação
      que já existe pro núcleo de estoque, aplicada ao fluxo real de
      checkout)

---

## Etapa 8 — Portal B2B

**Depende de:** Etapa 7 (fluxo de pedido já existe), `customers` tipo
`b2b` já existe no schema.

**Objetivo:** cliente empresarial compra por condição comercial
diferente do consumidor final, dentro do mesmo site.

Escopo:

- [ ] Login de cliente B2B vinculado a um `customer` (não confundir com
      `organization_members`, que é usuário interno da distribuidora)
- [ ] Tabela de preço diferenciada por cliente ou faixa de volume — 🔸
      decisão pendente: preço B2B é por cliente individual, por grupo,
      ou por faixa de quantidade? Modelar antes de criar a tabela
- [ ] Pedido por volume/atacado (quantidade mínima, múltiplos de
      embalagem)
- [ ] 🔸 decisão pendente: aprovação de crédito/limite por cliente B2B
      entra nesta etapa ou fica pra depois? Se entrar, definir a regra
      antes de implementar
- [ ] Histórico e cotações separados do fluxo B2C

---

## Etapa 9 — CRM

**Depende de:** Etapa 1 (`customers` já existe).

**Objetivo:** acompanhar relacionamento comercial com clientes B2B e
B2C, não só o pedido isolado.

Escopo:

- [ ] Funil de vendas (estágios configuráveis por organização, igual
      `location_types` já é configurável por organização desde a
      Etapa 4 — não hardcode estágio fixo da plataforma)
- [ ] Histórico de interação por cliente (ligação, e-mail, reunião)
- [ ] Tarefas e lembretes vinculados a um cliente ou oportunidade
- [ ] Vínculo entre oportunidade do CRM e pedido real quando fechar
      venda
- [ ] Instrumentar `audit_log` pras ações de CRM (hoje só as 3 ações do
      núcleo de estoque logam, conforme pendência já registrada em
      `arquitetura.md`)

---

## Etapa 10 — WMS operacional

**Depende de:** Etapa 4 (hierarquia de localização já desenhada:
`picking_waves`, `replenishment_tasks`, `inventory_sessions`,
`stock_transfers` — desenhadas, não implementadas ainda).

**Objetivo:** operação real de galpão, não só o núcleo transacional de
estoque que já existe.

Escopo:

- [ ] Recebimento (entrada de mercadoria, conferência contra pedido de
      compra)
- [ ] Picking por onda: criação de onda, priorização de pedido, tarefa
      por localização, identificação de operador
- [ ] Conferência e packing
- [ ] Expedição
- [ ] Reabastecimento da área de picking baseado em `min_quantity`/
      `max_quantity` por localização
- [ ] Inventário cíclico com leitura de código de barras, divergência e
      ajuste sempre gerando `stock_movements` (nunca sobrescrever saldo
      direto — mesmo princípio já aplicado no núcleo de estoque)
- [ ] Transferência entre filiais/depósitos sempre em duas pernas
      (saída da origem + entrada no destino), nunca um único UPDATE
- [ ] Não implementar IA de slotting nesta etapa — fica pra depois do
      WMS operacional ter uso real (mesma decisão já tomada na Etapa 4)

---

## Etapa 11 — Integração Mercado Livre

**Depende de:** Etapa 6 (catálogo), Etapa 3 (estoque). Estrutura de
mapeamento (`external_integrations`, `external_references`,
`integration_sync_logs`) já existe desde a Etapa 3/4, sem chamada real
ainda.

**Objetivo:** vender no Mercado Livre sem overselling nem duplicar
cadastro de produto.

Escopo:

- [ ] Autenticação OAuth com o Mercado Livre, credencial salva em
      `external_integrations` (nunca no frontend, nunca em variável
      `NEXT_PUBLIC_`)
- [ ] Publicação de produto interno como anúncio (mapeado via
      `external_references`)
- [ ] Importação de pedido do Mercado Livre como `order` interno, canal
      `mercado_livre`
- [ ] Sincronização de estoque: toda venda no ML reserva estoque
      interno pra evitar vender o mesmo item duas vezes em canais
      diferentes
- [ ] Webhook de atualização (pedido, status, cancelamento)
- [ ] Log de sincronização em `integration_sync_logs`, idempotente por
      tentativa
- [ ] Consultar a documentação oficial da API do Mercado Livre antes de
      implementar endpoint — não inventar contrato de API

---

## Etapa 12 — Integração Shopee

**Depende de:** Etapa 11 (mesma estrutura de integração, já validada
com Mercado Livre).

**Objetivo:** mesmo escopo da Etapa 11, adaptado à API da Shopee.

Escopo:

- [ ] Autenticação e credencial em `external_integrations`
- [ ] Publicação de produto / mapeamento via `external_references`
- [ ] Importação de pedido, canal `shopee`
- [ ] Sincronização de estoque compartilhada com os demais canais (não
      pode ser uma lógica separada da usada no Mercado Livre — reusar o
      mesmo núcleo de reserva/sincronização)
- [ ] Webhook e log de sincronização
- [ ] Consultar a documentação oficial da API da Shopee antes de
      implementar endpoint

---

## Etapa 13 — Dashboards e relatórios

**Depende de:** módulos que geram os dados (Etapas 7–12 — dashboard sem
dado real por trás não deve ser construído antes da hora, mesmo
princípio já usado pra IA de slotting e WMS na Etapa 4).

**Objetivo:** visibilidade gerencial por organização.

Escopo:

- [ ] Vendas por canal (site, B2B, Mercado Livre, Shopee, manual)
- [ ] Giro de estoque e ruptura
- [ ] Performance de picking/expedição (depende da Etapa 10 existir)
- [ ] Cada organização só vê os próprios dados (isolamento herdado da
      RLS, validar mesmo assim com script automatizado)

---

## Etapa 14 — Onboarding de nova empresa (replicar a base estrutural)

**Depende de:** todas as etapas anteriores existirem — esta é a etapa
que fecha o ciclo "um código, N empresas" na prática.

**Objetivo:** dar de alta uma empresa nova no SaaS sem trabalho manual
no banco — ela nasce com toda a base estrutural pronta (catálogo vazio
mas funcional, WMS configurável, ecommerce ativo, CRM ativo,
integrações disponíveis pra conectar), faltando só ela configurar o
próprio conteúdo.

Escopo:

- [ ] Fluxo/script de criação de organização nova: `organizations` +
      domínio/subdomínio (Etapa 5) + usuário admin inicial +
      `organization_members` com papel `admin`
- [ ] Seed mínimo por organização nova: nenhum `location_type`
      pré-cadastrado (quem configura é o cliente, mesma decisão já
      tomada na Etapa 4), mas os módulos (catálogo, ecommerce, CRM,
      integrações) já disponíveis e navegáveis vazios, sem erro
- [ ] Branding inicial (logo padrão da plataforma até a empresa trocar)
- [ ] 🔸 decisão pendente: existe cobrança (plano/assinatura) nesta
      etapa? `arquitetura.md` já registra que `plans` +
      `organization_subscriptions` foram desenhadas mas não criadas por
      falta de modelo de cobrança definido — resolver isso é
      pré-requisito se o onboarding for self-service; se o cadastro
      continuar manual (só o Carlos cadastrando cliente novo), cobrança
      pode ficar fora do escopo desta etapa
- [ ] Teste automatizado: criar uma organização nova do zero e validar
      que ela não enxerga nem é enxergada por nenhuma organização
      existente, em todos os módulos (não só estoque, que já é testado
      desde a Etapa 2/3)
