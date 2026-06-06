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
- **Período de Teste**: Trial estendido de 7 para 14 dias para novas barbearias.
- **Régua de Cobrança e Suspensão**: Implementada lógica de 10 dias de carência pós-vencimento. Inclui avisos preventivos (5 dias antes), popups diários de inadimplência (1x ao dia) e bloqueio total no 11º dia.
- **Persistência de Login**: Migração da sessão de barbeiros para `localStorage` e implementação de "Lembrar E-mail" na tela de login, facilitando o acesso diário e melhorando a integração com gerenciadores de senha.

### 👥 Gestão de Clientes e LGPD
...
*Última atualização: 31 de Maio de 2026*
## 🗺 Norte do Projeto (Roadmap)

### 🚀 Roadmap SaaS
- [x] **Isolamento de Dados (Multi-tenancy)**: RLS com `user_barbershops()` + migrations de segurança aplicadas.
- [x] **Portal Administrativo Dedicado**: `admin.narvalha.com.br` com login separado e dashboard SaaS.
- [x] **Sistema Multi-Loja**: Loja matriz (Platina) pode criar filiais. Switcher no sidebar. Cada filial tem assinatura própria.
- [ ] **Sistema de Subdomínios**: Link único por barbearia (`jc.narvalha.com.br`). Bloqueado: requer Vercel Pro. Alternativa: path `narvalha.com.br/b/<slug>`.

### 📈 Funcionalidades de Negócio
- [x] **Dashboard Estatístico**: Gráficos 7D / 30D / 12M com comparação % vs período anterior.
- [x] **App PWA**: manifest.json + service worker registrado. Falta: gerar icon-192.png e icon-512.png.
- [x] **Sistema de Fidelidade**: Contador de serviços automatizado via RPC `close_order`.
- [x] **Controle de Despesas**: Aba financeira completa com contas a pagar e gestão de recorrência.
- [ ] **Nível de Acesso por Loja**: Permissões granulares por membro — ex: "só pode mexer no caixa", "só acessa loja 1 ou 2". Cada role define quais módulos e quais lojas o usuário pode acessar.
- [ ] **Integração de Fotos**: Upload de fotos "Antes e Depois" vinculadas ao cliente.

---

## 🧠 Skills Desejadas da IA

Para que o desenvolvimento flua rápido, a IA deve possuir estas habilidades:
- **Expert em SQL/PostgreSQL**: Domínio de triggers, funções (RPC) e políticas RLS no Supabase.
- **Arquiteto React/TypeScript**: Criação de componentes performáticos e tipagem rigorosa.
- **Foco em Mobile UX**: Design pensado para o barbeiro que usa o celular com uma mão só enquanto trabalha.
- **Otimização de Contexto**: Capacidade de entender as regras de multi-tenant (várias barbearias no mesmo banco).
- **DNS e Routing**: Conhecimento em subdomínios dinâmicos e redirecionamento de host.
---

*Última atualização: 31 de Maio de 2026*
