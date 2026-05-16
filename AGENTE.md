# Narvalha - Guia de Desenvolvimento do Agente

Este documento serve como bússola para qualquer IA ou desenvolvedor que atue no projeto Narvalha. Ele contém o histórico de melhorias, as regras de negócio implementadas e o roadmap futuro.

## 🚀 Processos Concluídos

### 🛠 Infraestrutura e Deploy
- **Vercel + Supabase**: Conexão estabelecida com sucesso.
- **Variáveis de Ambiente**: Configurado para aceitar o prefixo `A_` (padrão de integração automática do Vercel).
- **SPA Routing**: Criado `vercel.json` para evitar erro 404 ao dar F5 nas páginas.
- **SQL Database**: Banco de dados unificado e seguro com scripts que previnem erros de duplicidade.
- **Deploy de Edge Functions**: Implementadas e subidas funções para Stripe Checkout, Portal do Cliente e Webhooks.

### 📅 Agenda e Agendamento Online
- **Layout Compacto**: Agenda otimizada para visão vertical com scroll interno e cabeçalhos fixos.
- **Capacidade Simultânea**: Implementada a lógica de "Número de Cadeiras" nas configurações. O sistema impede que mais clientes agendem do que a capacidade física permite.
- **Duração de Serviços**: O sistema calcula automaticamente o fim do serviço para liberar o próximo horário.
- **Botão Novo Agendamento**: Atalho manual para criar horários sem depender da grade.
- **Remoção de Link Público**: O recurso de agendamento online externo foi removido conforme solicitação (routes, sidebar e página deletados).
- **Máscara de Telefone**: Implementada validação de 11 dígitos em todos os fluxos de agendamento.

### 💰 Financeiro, PDV e SaaS
- **SaaS Subscription**: Sistema de planos (Prata, Ouro, Platina) integrado ao Stripe com bloqueio automático (temporariamente desativado para validação).
- **Stripe Integration**: Fluxo completo de pagamento com criação automática de clientes e webhooks de confirmação.
- **Portal do Cliente**: Botão nas configurações para o dono da barbearia gerenciar sua assinatura no Stripe.
- **PDV Refinado**: Adicionado fluxo de seleção de barbeiro antes da venda.
- **Regra de Comissões**: Barbeiros ganham comissão automática apenas em **Serviços**. Produtos agora têm comissão zerada por padrão no PDV.
- **Sistema de Fidelidade**: Implementado contador de serviços (10º corte gratuito) com lógica centralizada no RPC `close_order`. Visualização do progresso em Clientes, POS e PDV.
- **Refatoração PDV**: Vendas avulsas agora utilizam o mesmo fluxo de fechamento (`close_order`) das comandas da agenda, garantindo integridade de estoque, caixa e fidelidade.
- **Controle de Despesas**: Aba financeira completa com contas a pagar/receber, categorias de gastos (aluguel, luz, etc.) e gestão de recorrência.
- **Caixa às Cegas**: Nova configuração que permite esconder valores esperados no fechamento de caixa, forçando uma contagem física neutra para evitar furos e manipulações.
- **Período de Teste**: Trial estendido de 7 para 14 dias para novas barbearias.

### 👥 Gestão de Clientes e LGPD
- **LGPD Compliance**: Implementada política de privacidade, aceite de termos no signup, consentimento de marketing e logs de transparência.
- **Lembretes WhatsApp**: Botão direto na lista de clientes que gera uma mensagem automática personalizada.
- **Ciclos de Retorno**: Opções de 15, 30, 45, 60 e 120 dias configuráveis por cliente.
- **Rastreio de Visita**: A coluna "Última Visita" é atualizada automaticamente quando um agendamento é finalizado.

### 🎨 Interface e Mobile
- **Mobile-First Layout**: Implementado menu sanduíche (hambúrguer) e layout 100% responsivo e proporcional.
- **Tema Personalizado**: Tema claro ajustado para um tom de **bege sofisticado** com textos em preto.
- **Login Social**: Implementado botão "Entrar com Google" na tela de login.

---

## 🗺 Norte do Projeto (Roadmap)

### 🚀 Roadmap SaaS (TO-DO)
- [x] **Controle de Acesso por Assinatura**: Bloquear acesso total ao sistema caso a mensalidade não esteja paga. (Implementado via RLS e Frontend redirect)
- [x] **Dashboard de Administração SaaS**: Tela para você (dono do Narvalha) gerenciar todos os clientes, pagamentos e bloqueios.
- [x] **Portal de Pagamento (Checkout)**: Criar tela de pagamento (Stripe) exclusiva para o dono da barbearia assinar o Narvalha. (Implementado via Stripe Checkout e Edge Functions)
- [ ] **Isolamento de Dados (Multi-tenancy)**: Refinar via RLS (Row Level Security) do Supabase para garantir isolamento total.
- [ ] **Sistema de Subdomínios**: Implementar lógica para que cada barbearia tenha seu link único (ex: `barbearia-do-ze.narvalha.com.br`).

### 📈 Funcionalidades de Negócio
- [ ] **Dashboard Estatístico**: Gráficos de faturamento diário, semanal e mensal.
- [x] **Sistema de Fidelidade**: Contador de serviços para dar "o 10º corte gratuito".
- [x] **Controle de Despesas**: Aba para cadastrar gastos fixos (aluguel, luz) e variáveis.
- [ ] **App PWA**: Configurar para que o dono da barbearia possa "instalar" o site como um app no celular.
- [ ] **Integração de Fotos**: Upload de fotos de "Antes e Depois" vinculadas ao cliente.

---

## 🧠 Skills Desejadas da IA

Para que o desenvolvimento flua rápido, a IA deve possuir estas habilidades:
- **Expert em SQL/PostgreSQL**: Domínio de triggers, funções (RPC) e políticas RLS no Supabase.
- **Arquiteto React/TypeScript**: Criação de componentes performáticos e tipagem rigorosa.
- **Foco em Mobile UX**: Design pensado para o barbeiro que usa o celular com uma mão só enquanto trabalha.
- **Otimização de Contexto**: Capacidade de entender as regras de multi-tenant (várias barbearias no mesmo banco).

---

*Última atualização: 15 de Maio de 2026*
