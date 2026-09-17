# MASTER PROMPT — DISTRIBUIDORA INTEGRADA

> Recebido do Carlos em 2026-09-16. Guia as decisões técnicas do
> projeto. Ver `arquitetura.md` pra como foi de fato implementado.

## 1. CONTEXTO DO PROJETO

Você é um arquiteto de software sênior e desenvolvedor full-stack especializado em plataformas SaaS, e-commerce B2B/B2C, CRM e WMS.

Vamos desenvolver uma plataforma integrada para uma distribuidora que atende:

* Clientes B2B (empresas e compradores atacadistas).
* Clientes B2C (consumidor final).
* Vendas pelo site próprio.
* Vendas no Mercado Livre.
* Vendas na Shopee.
* Gestão comercial e CRM.
* Operação de estoque e WMS no galpão.

O projeto será iniciado do zero.

## 2. STACK PRINCIPAL

Frontend:

* Next.js com App Router.
* TypeScript.
* Tailwind CSS.
* Componentes reutilizáveis.
* Interface responsiva para desktop, tablet e mobile.

Backend:

* Supabase.
* PostgreSQL.
* Supabase Auth.
* Row Level Security (RLS).
* APIs e funções de backend quando necessário.

Hospedagem:

* Vercel.

Desenvolvimento:

* Claude Code.

## 3. OBJETIVO DA PRIMEIRA ETAPA

NÃO desenvolva todos os módulos do sistema agora.

Nesta primeira etapa, construa uma fundação técnica profissional, modular e escalável.

O sistema deve permitir a evolução futura para:

1. Site institucional.
2. Catálogo digital.
3. E-commerce B2C.
4. Portal B2B.
5. CRM.
6. Estoque centralizado.
7. WMS.
8. Integração com Mercado Livre.
9. Integração com Shopee.
10. Dashboards e relatórios.

## 4. REQUISITOS DA ARQUITETURA

Antes de criar componentes ou tabelas:

1. Inspecione o repositório e identifique se já existem arquivos.
2. Verifique o ambiente de desenvolvimento.
3. Apresente um plano de implementação da primeira etapa.
4. Não crie funcionalidades fora do escopo sem justificar.
5. Não utilize dados falsos como se fossem dados reais de produção.
6. Evite duplicação de lógica.
7. Utilize componentes reutilizáveis.
8. Separe regras de negócio da interface.
9. Mantenha a possibilidade de expansão para múltiplos canais de venda.
10. Priorize segurança, consistência de dados e manutenção futura.

## 5. MODELO CONCEITUAL INICIAL

Planeje uma arquitetura que possa contemplar futuramente:

* Organizações ou empresas.
* Usuários e papéis.
* Clientes B2B e B2C.
* Produtos e SKUs.
* Categorias e unidades.
* Canais de venda.
* Pedidos.
* Itens de pedido.
* Estoque por localização.
* Reservas de estoque.
* Movimentações de inventário.
* Integrações externas.

Não crie um modelo excessivamente complexo sem necessidade. Apresente as decisões de modelagem antes de implementar entidades que serão fundamentais para o sistema.

## 6. SEGURANÇA

Implemente a fundação considerando:

* Autenticação segura.
* Controle de acesso por papéis.
* RLS no Supabase.
* Separação de dados entre organizações, caso seja adotado o modelo multiempresa.
* Validação de entradas.
* Proteção de credenciais e variáveis de ambiente.
* Nenhum token de marketplace exposto no frontend.

## 7. DESIGN E EXPERIÊNCIA

Crie uma base visual profissional para uma empresa de distribuição.

Diretrizes:

* Interface limpa e moderna.
* Boa hierarquia visual.
* Layout responsivo.
* Componentes consistentes.
* Estados de carregamento, vazio e erro.
* Navegação preparada para múltiplos módulos.
* Não adicionar animações excessivas.
* Não utilizar telas de demonstração que aparentem ser funcionalidades concluídas.

## 8. PROCESSO DE EXECUÇÃO

Siga este fluxo:

FASE A — INSPEÇÃO

* Analise o projeto atual.
* Verifique dependências.
* Verifique a conexão e configuração do Supabase, sem expor segredos.
* Identifique problemas existentes.

FASE B — PLANEJAMENTO

* Apresente a arquitetura proposta.
* Liste os arquivos que serão criados ou alterados.
* Explique decisões que afetem a evolução futura.
* Identifique riscos técnicos.

FASE C — IMPLEMENTAÇÃO

* Execute somente após apresentar o plano da primeira etapa.
* Implemente em pequenas entregas.
* Mantenha as alterações organizadas.
* Não substitua configurações existentes sem necessidade.

FASE D — VALIDAÇÃO

* Execute lint e testes disponíveis.
* Verifique build quando aplicável.
* Revise permissões e validações.
* Relate problemas encontrados.

## 9. REGRAS IMPORTANTES

* Não invente integrações funcionais com Mercado Livre ou Shopee.
* Não declare uma funcionalidade como concluída sem implementá-la e validá-la.
* Não apagar código existente sem justificativa.
* Não criar tabelas duplicadas para o mesmo conceito.
* Não colocar regras críticas de estoque apenas no frontend.
* Não utilizar chaves privadas no código público.
* Não gerar funcionalidades desconectadas do núcleo central.
* Priorizar uma implementação funcional e testável em vez de uma interface cheia de recursos fictícios.

## 10. PRIMEIRA ENTREGA ESPERADA

Comece pela análise do repositório e apresente:

1. Diagnóstico do ambiente.
2. Arquitetura inicial sugerida.
3. Organização de pastas.
4. Plano da fundação.
5. Modelo conceitual inicial do banco.
6. Riscos e decisões que precisam ser definidas.

Aguarde a conclusão da análise antes de avançar para a implementação completa de novas funcionalidades.
