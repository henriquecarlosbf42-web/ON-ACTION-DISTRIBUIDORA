# MASTER PROMPT — ETAPA 4 — MODELAGEM DO BANCO DE DADOS E NÚCLEO DE ESTOQUE

> Recebido do Carlos em 2026-09-16. Ver `arquitetura.md` pra como foi
> de fato implementado (hierarquia organização→filial→depósito→
> localização + capacidade cúbica + correção do bug de SKU global;
> picking/reabastecimento/inventário/transferências ficaram
> desenhados, não implementados).

## CONTEXTO

Estamos desenvolvendo um SaaS para distribuidoras, inicialmente para nossa própria operação, com possibilidade de comercialização futura.

O sistema atende:

* B2B.
* B2C.
* E-commerce.
* Mercado Livre.
* Shopee.
* CRM.
* WMS.
* Múltiplas filiais e locais de estoque.

STACK:

* Next.js.
* TypeScript.
* Supabase PostgreSQL.
* Supabase Auth.
* RLS.
* Vercel.
* Claude Code.

## OBJETIVO DA ETAPA

Projetar e implementar a base de dados do núcleo de estoque, preparada para múltiplas organizações, filiais, depósitos e endereços.

FUNCIONALIDADES PRIORITÁRIAS:

1. Estoque em vários locais e filiais.
2. Endereçamento por rua, coluna e nível.
3. Controle de volume cúbico das localizações.
4. Picking por onda.
5. Reabastecimento da área de picking.
6. Inventário com coletor de código de barras.
7. Transferência entre endereços e filiais.
8. Separação por prioridade de pedido.

## 1. INSPEÇÃO OBRIGATÓRIA

Antes de alterar arquivos:

* Inspecione o repositório.
* Analise migrations existentes.
* Verifique o modelo multi-tenant.
* Identifique tabelas já criadas.
* Verifique dependências e configurações.
* Não apague ou substitua funcionalidades sem justificativa.

Apresente um diagnóstico e um plano antes de implementar alterações estruturais.

## 2. HIERARQUIA DO ESTOQUE

Projete a estrutura:

ORGANIZATION
→ BRANCH
→ WAREHOUSE
→ LOCATION
→ INVENTORY BALANCE

Uma organização pode possuir várias filiais.
Uma filial pode possuir vários depósitos.
Um depósito pode possuir múltiplas localizações.

Avalie os relacionamentos e regras de unicidade apropriados para cada entidade.

## 3. MODELAGEM DE DADOS

Analise e proponha tabelas para:

### Organização

* organizations.
* branches.
* warehouses.

### Produtos

* products.
* SKUs.
* códigos de barras.
* unidades de medida.

### Endereçamento

* locations.
* location_types.
* capacity configuration.

### Estoque

* inventory_balances.
* inventory_movements.
* stock_reservations.

### Picking

* picking_waves.
* picking_wave_orders.
* picking_tasks.
* picking_task_items.

### Reabastecimento

* replenishment_tasks.
* Regras de estoque mínimo e máximo.

### Inventário

* inventory_sessions.
* inventory_counts.
* inventory_adjustments.

### Transferências

* stock_transfers.
* stock_transfer_items.
* Fluxo de aprovação, trânsito e recebimento.

Não crie todas as tabelas sem validar os relacionamentos e dependências.

## 4. REGRAS DE ESTOQUE

Defina regras para:

* Estoque físico.
* Estoque reservado.
* Estoque disponível.
* Concorrência de reservas.
* Movimentações transacionais.
* Idempotência.
* Cancelamento e liberação.
* Auditoria.

O estoque não pode depender apenas de cálculos no frontend.

Utilize mecanismos apropriados do PostgreSQL e do backend para proteger as operações críticas.

## 5. CAPACIDADE CÚBICA

Projete suporte para:

* Largura.
* Profundidade.
* Altura.
* Volume total.
* Volume útil.
* Peso máximo.
* Restrições operacionais.

Não trate o volume geométrico como garantia de capacidade real de armazenagem. Permita regras e configurações específicas.

## 6. PICKING E REABASTECIMENTO

Planeje:

* Criação de ondas.
* Priorização de pedidos.
* Tarefas por localização.
* Controle de status.
* Identificação de operadores.
* Reabastecimento baseado em níveis configurados.
* Verificação de estoque na área de reserva.
* Prevenção de tarefas duplicadas.

## 7. INVENTÁRIO E TRANSFERÊNCIAS

Implemente uma arquitetura preparada para:

* Leitura de códigos de barras.
* Contagem por localização.
* Tratamento de divergências.
* Ajustes auditáveis.
* Transferências internas.
* Transferências entre filiais.
* Controle de trânsito e recebimento.

## 8. SEGURANÇA

Garanta:

* RLS por organização.
* Controle de acesso por papel.
* Validação de filial e depósito.
* Auditoria.
* Proteção contra acesso cruzado.
* Validações no backend.

## 9. PROCESSO DE IMPLEMENTAÇÃO

FASE A:

* Diagnóstico.
* Modelo conceitual.
* Dependências.
* Riscos.

FASE B:

* Proposta de migrations.
* Políticas RLS.
* Índices e restrições.
* Estratégia de transações.

FASE C:

* Implementação incremental.
* Testes de isolamento.
* Testes de estoque.
* Testes de concorrência e idempotência quando aplicável.

FASE D:

* Lint.
* Testes.
* Build.
* Revisão de migrations.
* Documentação.

## REGRAS PRINCIPAIS

* Não inventar integrações externas.
* Não usar dados fictícios como dados de produção.
* Não duplicar lógica crítica.
* Não implementar o WMS inteiro nesta etapa.
* Não declarar uma funcionalidade concluída sem validação.
* Não apagar código existente sem justificativa.

PRIMEIRA ENTREGA:

Apresente a arquitetura do banco e o plano de implementação antes de criar as migrations definitivas.
