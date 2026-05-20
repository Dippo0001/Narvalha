import { Link } from 'react-router-dom';
import {
  Calendar, ShoppingCart, Wallet, Award, Store, Smartphone,
  ArrowRight, Check, Sparkles,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-ink-950 text-ink-50 overflow-x-hidden">
      {/* Subtle radial glow */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.15), transparent)',
        }}
      />

      <Nav />

      <main className="relative">
        <Hero />
        <Trust />
        <Features />
        <Pricing />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

/* ─── NAV ───────────────────────────────────────────────────── */
function Nav() {
  return (
    <header className="relative z-10 px-6 lg:px-12 py-6 flex items-center justify-between max-w-7xl mx-auto">
      <span className="logo text-3xl">Navalha</span>
      <nav className="flex items-center gap-4 md:gap-8 text-sm">
        <a href="#funcionalidades" className="hidden md:inline text-ink-400 hover:text-ink-100 transition-colors">Funcionalidades</a>
        <a href="#planos" className="hidden md:inline text-ink-400 hover:text-ink-100 transition-colors">Planos</a>
        <Link to="/login" className="text-ink-400 hover:text-ink-100 transition-colors">Entrar</Link>
        <Link to="/signup" className="btn-primary text-sm px-4 py-2 rounded-md">
          Começar grátis
        </Link>
      </nav>
    </header>
  );
}

/* ─── HERO ──────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative px-6 lg:px-12 pt-16 md:pt-28 pb-24 max-w-5xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-900 border border-ink-800 text-xs text-ink-400 mb-8">
        <Sparkles size={12} className="text-emerald-400" />
        <span>14 dias grátis · sem cartão de crédito</span>
      </div>

      <h1 className="logo text-5xl md:text-7xl lg:text-8xl leading-[1.05] mb-6">
        Sua barbearia,
        <br />
        <em className="text-ink-300">em outro nível.</em>
      </h1>

      <p className="text-base md:text-lg text-ink-400 max-w-xl mx-auto mb-10 leading-relaxed">
        O ERP feito pra quem cansou de planilha, WhatsApp solto e caderno bagunçado.
        Foque no que importa: cortar bem e crescer.
      </p>

      <div className="flex items-center justify-center gap-4 flex-wrap">
        <Link to="/signup" className="btn-primary px-6 py-3 rounded-md text-sm font-medium inline-flex items-center gap-2 group">
          Começar agora
          <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <a href="#funcionalidades" className="text-sm text-ink-400 hover:text-ink-100 transition-colors px-4 py-3">
          Ver funcionalidades
        </a>
      </div>
    </section>
  );
}

/* ─── TRUST / PROBLEM ───────────────────────────────────────── */
function Trust() {
  return (
    <section className="relative px-6 lg:px-12 py-16 max-w-4xl mx-auto">
      <div className="border-t border-ink-900 pt-16">
        <p className="text-xs text-ink-600 uppercase tracking-widest text-center mb-6">O problema</p>
        <h2 className="logo text-3xl md:text-5xl text-center leading-tight">
          Você perde 2 horas por dia
          <br />
          <em className="text-ink-500">em coisa que não corta cabelo.</em>
        </h2>
        <p className="text-center text-ink-400 mt-8 max-w-xl mx-auto leading-relaxed">
          Agenda no caderno, fluxo de caixa na cabeça, cliente esquecido,
          comissão calculada no susto. O Navalha resolve tudo isso num lugar só.
        </p>
      </div>
    </section>
  );
}

/* ─── FEATURES ──────────────────────────────────────────────── */
function Features() {
  const items = [
    {
      icon: Calendar,
      title: 'Agenda inteligente',
      desc: 'Múltiplos barbeiros, capacidade simultânea, bloqueio automático de horário ocupado.',
    },
    {
      icon: ShoppingCart,
      title: 'PDV completo',
      desc: 'Venda serviços e produtos com comissão calculada na hora. Pagamento em PIX, débito e crédito.',
    },
    {
      icon: Wallet,
      title: 'Caixa e financeiro',
      desc: 'Entradas, saídas, contas a pagar e receber. Fechamento de caixa às cegas para evitar furos.',
    },
    {
      icon: Award,
      title: 'Fidelidade automática',
      desc: 'A cada 10 cortes, o 11º sai por conta da casa. Contador automático para cada cliente.',
    },
    {
      icon: Store,
      title: 'Multi-loja',
      desc: 'Gerencie matriz e filiais em um só painel. Disponível no plano Platina.',
    },
    {
      icon: Smartphone,
      title: 'No bolso',
      desc: 'Acesse pelo celular como um app. Interface otimizada para telas pequenas.',
    },
  ];

  return (
    <section id="funcionalidades" className="relative px-6 lg:px-12 py-24 max-w-6xl mx-auto">
      <p className="text-xs text-ink-600 uppercase tracking-widest text-center mb-4">Funcionalidades</p>
      <h2 className="logo text-3xl md:text-5xl text-center mb-16 leading-tight">
        Tudo que sua barbearia
        <br />
        <em className="text-ink-400">precisa.</em>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink-900 border border-ink-900 rounded-xl overflow-hidden">
        {items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-ink-950 p-8 hover:bg-ink-900/40 transition-colors">
            <Icon size={20} className="text-emerald-400 mb-4" strokeWidth={1.5} />
            <h3 className="text-base font-medium mb-2">{title}</h3>
            <p className="text-sm text-ink-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── PRICING ───────────────────────────────────────────────── */
function Pricing() {
  const plans = [
    {
      id: 'silver',
      name: 'Prata',
      price: '29',
      cents: '90',
      features: ['Até 2 barbeiros', '10 serviços e 10 produtos', 'Agenda + PDV', 'Contas a pagar/receber', 'Suporte 5x2'],
    },
    {
      id: 'platinum',
      name: 'Platina',
      price: '59',
      cents: '90',
      popular: true,
      features: ['Barbeiros ilimitados', 'Serviços/produtos ilimitados', 'Tudo do Ouro', 'Módulo de promoções', 'Multi-loja (matriz + filiais)'],
    },
    {
      id: 'gold',
      name: 'Ouro',
      price: '49',
      cents: '90',
      features: ['Até 5 barbeiros', '20 serviços e 20 produtos', 'Tudo do Prata', 'Módulo financeiro completo', 'Fidelidade automática'],
    },
  ];

  return (
    <section id="planos" className="relative px-6 lg:px-12 py-24 max-w-6xl mx-auto">
      <p className="text-xs text-ink-600 uppercase tracking-widest text-center mb-4">Planos</p>
      <h2 className="logo text-3xl md:text-5xl text-center mb-3 leading-tight">
        Comece de graça.
      </h2>
      <p className="text-center text-ink-400 mb-16">14 dias para testar tudo. Sem cartão.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`relative card p-8 flex flex-col ${plan.popular ? 'border-emerald-500/40 ring-1 ring-emerald-500/20' : ''}`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest bg-emerald-500 text-emerald-950 px-3 py-1 rounded-full font-bold">
                Mais popular
              </span>
            )}

            <h3 className="logo text-3xl mb-1">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-xs text-ink-500">R$</span>
              <span className="text-4xl font-semibold">{plan.price}</span>
              <span className="text-sm text-ink-500">,{plan.cents}/mês</span>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-300">
                  <Check size={14} className="text-emerald-400 mt-0.5 shrink-0" strokeWidth={2.5} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/signup"
              className={`text-center py-3 rounded-md text-sm font-medium transition-all ${
                plan.popular
                  ? 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                  : 'border border-ink-800 text-ink-200 hover:bg-ink-900'
              }`}
            >
              Começar com {plan.name}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── FINAL CTA ─────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="relative px-6 lg:px-12 py-32 max-w-4xl mx-auto text-center">
      <h2 className="logo text-4xl md:text-6xl leading-tight mb-6">
        Pronto pra
        <br />
        <em className="text-ink-300">profissionalizar?</em>
      </h2>
      <p className="text-ink-400 mb-10 max-w-md mx-auto">
        Crie sua conta agora. 14 dias grátis, sem cartão. Depois, a partir de R$ 29,90/mês.
      </p>
      <Link
        to="/signup"
        className="btn-primary px-8 py-4 rounded-md text-sm font-medium inline-flex items-center gap-2 group"
      >
        Criar minha conta
        <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </section>
  );
}

/* ─── FOOTER ────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="relative border-t border-ink-900 px-6 lg:px-12 py-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-ink-500">
        <span className="logo text-xl text-ink-300">Navalha</span>
        <div className="flex items-center gap-6">
          <Link to="/privacidade" className="hover:text-ink-200 transition-colors">Privacidade</Link>
          <Link to="/login" className="hover:text-ink-200 transition-colors">Entrar</Link>
        </div>
        <span>© {new Date().getFullYear()} Navalha</span>
      </div>
    </footer>
  );
}
