# MASTER PROMPT — ETAPA 3 — ARQUITETURA DO PRODUTO SAAS

> Recebido do Carlos em 2026-09-16. Ver `arquitetura.md` pra como foi
> de fato implementado (núcleo de estoque + fundação de integrações;
> WMS/IA/dashboards/planos ficaram documentados, não implementados).

## CONTEXTO

Estamos desenvolvendo um SaaS para distribuidoras que também operam e-commerce.

O produto será utilizado inicialmente pela nossa própria distribuidora e poderá ser comercializado futuramente para outras empresas.

Modelo:

* B2B + B2C.
* Site próprio e e-commerce.
* CRM.
* WMS.
* Mercado Livre.
* Shopee.

Tecnologia:

* Next.js.
* TypeScript.
* Supabase PostgreSQL.
* Supabase Auth.
* Vercel.
* Claude Code.

## DIFERENCIAIS DO PRODUTO

1. WMS completo.
2. Integrações com marketplaces.
3. IA para gestão de estoque e slotting.
4. Dashboards de produtividade.

O modelo comercial e os preços ainda não foram definidos.

## OBJETIVO

Estruturar o produto e sua arquitetura técnica para permitir evolução modular e comercialização futura como SaaS.

Não desenvolver todos os módulos de uma vez.

## 1. INSPEÇÃO

Antes de implementar:

* Inspecione o repositório.
* Verifique o que já foi desenvolvido nas etapas anteriores.
* Analise as migrations existentes.
* Verifique a arquitetura de autenticação e multi-tenant.
* Identifique dependências e riscos.
* Não apague funcionalidades existentes sem justificativa.

## 2. DOMÍNIOS DO PRODUTO

Planeje os limites entre:

### Comercial

* Catálogo.
* Produtos.
* Clientes.
* Pedidos.
* Preços B2B/B2C.
* Canais de venda.

### Estoque

* Saldos.
* Reservas.
* Movimentações.
* Depósitos.
* Localizações.
* Inventário.

### WMS

* Recebimento.
* Picking.
* Conferência.
* Packing.
* Expedição.
* Reabastecimento.

### Integrações

* Mercado Livre.
* Shopee.
* Mapeamento de SKUs.
* Pedidos externos.
* Sincronização de estoque.
* Logs e reconciliação.

### Inteligência

* Indicadores operacionais.
* Recomendações de slotting.
* Capacidade cúbica.
* Reabastecimento.
* Análise de produtividade.

## 3. NÚCLEO DE ESTOQUE

Defina uma arquitetura centralizada para que os canais de venda e o WMS utilizem regras consistentes.

Considere:

* Estoque físico.
* Estoque reservado.
* Estoque disponível.
* Idempotência.
* Concorrência na reserva.
* Cancelamento e liberação.
* Auditoria.
* Origem do pedido.

As regras críticas devem ser implementadas no backend e protegidas por validações transacionais.

## 4. IA E SLOTTING

Projete uma arquitetura em que a IA forneça recomendações baseadas em dados reais.

Considere:

* Giro de produtos.
* Frequência de movimentação.
* Dimensões e peso.
* Capacidade cúbica.
* Restrições das localizações.
* Distância e produtividade.
* Reabastecimento.

Não permita que uma recomendação de IA altere diretamente o estoque sem validações e regras de negócio.

Separe:

* Dados de entrada.
* Motor de cálculo.
* Recomendação.
* Aprovação.
* Execução.
* Auditoria.

## 5. DASHBOARDS

Defina eventos e métricas para medir:

* Produtividade de picking.
* Produtividade de conferência.
* Tempo de ciclo do pedido.
* Pedidos processados.
* Divergências.
* Tempo por etapa.
* Indicadores por operador e período.

As métricas devem possuir definições claras e utilizar dados reais registrados pelo sistema.

## 6. ARQUITETURA DE INTEGRAÇÕES

Proponha uma camada de integração modular.

Considere:

* Credenciais seguras.
* Tokens e autorização.
* Mapeamento de IDs externos.
* Idempotência.
* Retry controlado.
* Logs.
* Reconciliação.
* Processamento assíncrono quando necessário.

Não invente endpoints ou declare integrações funcionais sem validação na documentação oficial.

## 7. PREPARAÇÃO COMERCIAL FUTURA

O sistema deverá permitir futuramente:

* Planos.
* Recursos por plano.
* Limites de uso.
* Assinaturas.
* Administração da plataforma.
* Controle de acesso por organização.

O modelo de cobrança ainda não está definido.

Projete interfaces de autorização desacopladas da apresentação e não bloqueie o desenvolvimento essencial por decisões comerciais ainda pendentes.

## 8. ENTREGAS ESPERADAS

Primeiro:

1. Diagnóstico do projeto.
2. Arquitetura de domínios.
3. Dependências entre módulos.
4. Modelo de dados necessário.
5. Estratégia do núcleo de estoque.
6. Arquitetura de integrações.
7. Plano para IA e dashboards.
8. Riscos e decisões pendentes.

Depois, proponha a primeira implementação incremental.

Não desenvolva todos os módulos de uma só vez.

## 9. VALIDAÇÃO

Ao implementar:

* Execute lint.
* Execute testes disponíveis.
* Valide RLS e isolamento entre organizações.
* Verifique migrations.
* Verifique o build.
* Teste regras de negócio críticas.
* Documente limitações.

Não declare funcionalidades como concluídas sem implementação e validação.

## REGRA PRINCIPAL

Construa uma base SaaS modular, segura e escalável, priorizando a consistência do estoque, a operação WMS e a capacidade de integração com múltiplos canais de venda.
