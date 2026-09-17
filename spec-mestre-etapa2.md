# MASTER PROMPT — ETAPA 2 — ARQUITETURA SAAS MULTI-TENANT

> Recebido do Carlos em 2026-09-16, logo após a Etapa 1. Ver
> `arquitetura.md` pra como foi de fato implementado.

## CONTEXTO

Estamos desenvolvendo uma plataforma integrada para uma distribuidora, com uso inicial na própria empresa e possibilidade de comercialização futura como SaaS para outras distribuidoras.

O sistema deverá atender:

* Operações B2B.
* Operações B2C.
* Site institucional e e-commerce.
* CRM e carteira de clientes.
* WMS de galpão.
* Mercado Livre.
* Shopee.
* Estoque centralizado.
* Dashboards e análises.

O projeto será desenvolvido do zero utilizando:

* Next.js.
* TypeScript.
* Supabase PostgreSQL.
* Supabase Auth.
* RLS.
* Vercel.
* Claude Code.

## OBJETIVO

Estruturar a arquitetura multi-tenant da aplicação desde o início, permitindo que múltiplas organizações utilizem o mesmo sistema com isolamento seguro de dados.

O projeto deve ser inicialmente funcional para uma empresa, mas sem exigir reconstrução da arquitetura quando novos clientes forem adicionados.

## 1. INSPEÇÃO INICIAL

Antes de implementar:

1. Inspecione o repositório.
2. Verifique a stack instalada.
3. Identifique configurações existentes.
4. Verifique o ambiente Supabase, sem expor credenciais.
5. Verifique se existem migrations, tabelas ou políticas já criadas.
6. Não sobrescreva ou apague arquivos sem justificativa.

Apresente o diagnóstico antes de alterar a estrutura.

## 2. MODELO MULTI-TENANT

Planeje a arquitetura com:

* organizations.
* organization_members.
* Usuários autenticados pelo Supabase Auth.
* Papéis e permissões.
* Dados comerciais vinculados à organização.
* Dados de estoque vinculados à organização.
* Configurações específicas por organização.

Cada registro de negócio deverá ter uma associação clara com a organização proprietária.

Analise quais entidades devem ser compartilhadas globalmente e quais devem pertencer a uma organização.

Não presuma que todos os dados precisam ser compartilhados entre empresas.

## 3. SEGURANÇA

Implemente a arquitetura considerando:

* RLS no PostgreSQL.
* Isolamento entre organizações.
* Validação de acesso no backend.
* Controle de acesso por papel.
* Proteção de rotas.
* Nenhuma credencial privada exposta no frontend.
* Auditoria de operações importantes.
* Testes de acesso cruzado entre organizações.

Não confie exclusivamente em filtros do frontend para proteger dados.

## 4. ESTRUTURA DE DOMÍNIO

Prepare a arquitetura para os seguintes domínios:

### Plataforma

* Organizações.
* Usuários.
* Membros.
* Papéis.
* Permissões.
* Configurações.

### Comercial

* Produtos.
* SKUs.
* Categorias.
* Clientes.
* Tabelas de preços.
* Pedidos.
* Canais de venda.

### Estoque e WMS

* Depósitos.
* Localizações.
* Saldos.
* Reservas.
* Movimentações.
* Recebimento.
* Picking.
* Conferência.
* Packing.
* Expedição.

### Integrações

* Mercado Livre.
* Shopee.
* Identificadores externos.
* Status de sincronização.
* Logs de integração.

Não implemente todas as funcionalidades acima nesta etapa. Estruture os limites e dependências dos domínios.

## 5. REGRAS DE ESTOQUE

Planeje o estoque como um núcleo central de negócio.

Considere:

* Estoque físico.
* Estoque reservado.
* Estoque disponível.
* Pedidos provenientes de múltiplos canais.
* Movimentações com histórico.
* Prevenção de reservas concorrentes.
* Identificação da origem dos pedidos.

Regras críticas devem ser executadas no backend com validação e consistência transacional.

## 6. ARQUITETURA DE CÓDIGO

Proponha uma estrutura modular para:

* App Router.
* Componentes reutilizáveis.
* Serviços de domínio.
* Validações.
* Acesso ao Supabase.
* Migrations.
* Testes.

Evite duplicar lógica entre CRM, e-commerce e WMS.

## 7. ENTREGAS DA ETAPA

Primeiro apresente:

1. Diagnóstico do projeto.
2. Arquitetura multi-tenant proposta.
3. Diagrama das relações entre os domínios.
4. Entidades e relacionamentos do banco.
5. Estratégia de RLS.
6. Estrutura de pastas.
7. Plano de migrations.
8. Riscos e decisões pendentes.

Depois da análise e aprovação do plano, implemente somente a fundação necessária para o multi-tenant.

## 8. VALIDAÇÃO

Ao implementar:

* Execute lint e testes disponíveis.
* Verifique as migrations.
* Teste o isolamento entre organizações.
* Teste permissões de acesso.
* Verifique o build.
* Documente problemas e limitações.

Não declare a etapa como concluída sem validar os pontos implementados.

## RESTRIÇÃO PRINCIPAL

Não desenvolver o site completo, CRM completo, e-commerce completo ou WMS completo nesta etapa.

O foco é construir uma fundação segura, modular e preparada para a expansão SaaS.
