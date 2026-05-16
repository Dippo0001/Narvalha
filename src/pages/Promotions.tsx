import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import {
  Plus, Pencil, Trash2, MessageCircle, ChevronRight,
  Coins, Scissors, Cake, Trophy, Clock, CalendarDays,
  Layers, RotateCcw, PackageCheck, CreditCard, ShoppingBag,
  X, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Product, Service } from '../types/db';

/* ─── types ─────────────────────────────────────────────────────── */
type PromotionTipo =
  | 'cashback' | 'primeiro_corte' | 'aniversario' | 'fidelidade'
  | 'happy_hour' | 'dia_fixo' | 'primeiro_horario'
  | 'combo' | 'retorno' | 'pacote' | 'assinatura' | 'produto_servico';

interface Promotion {
  id: string; barbershop_id: string; titulo: string; descricao: string;
  tipo: PromotionTipo; ativo: boolean; canal: string;
  mensagem_personalizada: string; filtro_tags: string[];
  // cashback
  cashback_percentual: number; cashback_validade_dias: number;
  // primeiro corte
  primeiro_corte_desconto: number;
  // aniversário
  aniversario_janela: string; aniversario_desconto: number;
  // fidelidade
  fidelidade_cortes: number;
  // happy hour
  happy_hour_dias: number[]; happy_hour_inicio: string; happy_hour_fim: string; happy_hour_desconto: number;
  // dia fixo
  dia_fixo_dia_semana: number; dia_fixo_valor: number;
  // primeiro horário
  primeiro_horario_desconto: number; primeiro_horario_slot: string;
  // combo
  combo_servico_ids: string[]; combo_valor_fixo: number;
  // retorno
  retorno_dias: number; retorno_desconto: number;
  // pacote
  pacote_cortes: number; pacote_preco: number;
  // assinatura
  assinatura_cortes_mes: number; assinatura_preco: number; assinatura_desconto_produtos: number;
  // produto+serviço
  produto_ids: string[]; produto_desconto: number;
}

/* ─── catalog ────────────────────────────────────────────────────── */
const TIPOS: { tipo: PromotionTipo; label: string; sub: string; icon: any; color: string; rank: 'silver' | 'gold' | 'platinum'; disabled?: boolean }[] = [
  { tipo: 'aniversario',      label: 'Aniversário',             icon: Cake,        color: 'text-pink-400',   sub: 'Desconto no dia/semana/mês', rank: 'silver' },
  { tipo: 'happy_hour',       label: 'Happy Hour',              icon: Clock,       color: 'text-emerald-400',sub: 'Desconto em horários fixos', rank: 'silver' },
  { tipo: 'dia_fixo',         label: 'Dia Fixo',                icon: CalendarDays,color: 'text-teal-400',   sub: 'Ex: Terça do Corte Social', rank: 'silver' },
  { tipo: 'produto_servico',  label: 'Produto + Serviço',       icon: ShoppingBag, color: 'text-rose-400',   sub: 'Produto com desconto no dia do corte', rank: 'silver' },
  { tipo: 'primeiro_corte',   label: 'Primeiro Corte',          icon: Scissors,    color: 'text-sky-400',    sub: 'Desconto na 1ª visita', rank: 'silver' },
  
  { tipo: 'cashback',         label: 'Cashback',                icon: Coins,       color: 'text-amber-400',  sub: '% de volta a cada corte', rank: 'gold' },
  { tipo: 'fidelidade',       label: 'Fidelidade',              icon: Trophy,      color: 'text-yellow-400', sub: 'Corte X vezes → próximo grátis', rank: 'gold' },
  { tipo: 'primeiro_horario', label: 'Primeiro Horário',        icon: Clock,       color: 'text-cyan-400',   sub: 'Desconto no 1º slot do dia', rank: 'gold' },
  { tipo: 'retorno',          label: 'Retorno',                 icon: RotateCcw,   color: 'text-blue-400',   sub: 'Desconto ao retornar em X dias', rank: 'gold' },
  { tipo: 'combo',            label: 'Combo de Serviços',       icon: Layers,      color: 'text-orange-400', sub: 'Pacote de serviços com valor fixo', rank: 'gold' },
  
  { tipo: 'assinatura',       label: 'Assinatura Mensal',       icon: CreditCard,  color: 'text-violet-400', sub: 'Receita recorrente previsível', rank: 'platinum' },
  { tipo: 'pacote',           label: 'Pacote Pré-pago',         icon: PackageCheck,color: 'text-lime-400',   sub: 'Pague 4, leve 5 cortes', rank: 'platinum' },
];

const PLAN_RANK: Record<string, number> = { trial: 3, silver: 1, gold: 2, platinum: 3 };
const RANK_LEVEL: Record<string, number> = { silver: 1, gold: 2, platinum: 3 };

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Promotions() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [pickModal, setPickModal] = useState(false);
  const [editModal, setEditModal] = useState<Promotion | null>(null);
  const [newTipo, setNewTipo] = useState<PromotionTipo | null>(null);
  const [fidelidadeModal, setFidelidadeModal] = useState<Promotion | null>(null);

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['promotions', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('promotions').select('*')
        .eq('barbershop_id', barbershop!.id).order('created_at', { ascending: false });
      return (data ?? []) as Promotion[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ['services', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('services').select('id,nome,valor').eq('barbershop_id', barbershop!.id).eq('ativo', true);
      return (data ?? []) as Pick<Service, 'id' | 'nome' | 'valor'>[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('id,nome,preco').eq('barbershop_id', barbershop!.id).eq('ativo', true);
      return (data ?? []) as Pick<Product, 'id' | 'nome' | 'preco'>[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-fidelidade', barbershop?.id, fidelidadeModal?.id],
    enabled: !!fidelidadeModal,
    queryFn: async () => {
      const { data } = await supabase.from('client_fidelidade').select('*, clients(nome, telefone)')
        .eq('promotion_id', fidelidadeModal!.id).order('cortes_acumulados', { ascending: false });
      return data ?? [];
    },
  });

  const save = async (form: Partial<Promotion>) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = editModal
      ? await supabase.from('promotions').update(payload).eq('id', editModal.id)
      : await supabase.from('promotions').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Promoção salva');
    qc.invalidateQueries({ queryKey: ['promotions'] });
    setEditModal(null);
    setNewTipo(null);
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta promoção?')) return;
    await supabase.from('promotions').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['promotions'] });
  };

  const toggleAtivo = async (p: Promotion) => {
    await supabase.from('promotions').update({ ativo: !p.ativo }).eq('id', p.id);
    qc.invalidateQueries({ queryKey: ['promotions'] });
  };

  const redeemFidelidade = async (fid: any) => {
    if (!fid) return;
    await supabase.from('client_fidelidade').update({ cortes_acumulados: 0, resgatado_em: new Date().toISOString() }).eq('id', fid.id);
    toast.success(`Corte grátis resgatado para ${fid.clients?.nome}. Fila resetada!`);
    qc.invalidateQueries({ queryKey: ['clients-fidelidade'] });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Promoções"
        actions={
          <button className="btn-primary" onClick={() => setPickModal(true)}>
            <Plus size={15} /> Nova promoção
          </button>
        }
      />

      {/* promotion cards */}
      <div className="space-y-3">
        {isLoading && <Skeleton />}
        {!isLoading && (!promotions || promotions.length === 0) && <EmptyState />}
        {(promotions ?? []).map((p) => (
          <PromotionCard
            key={p.id}
            promo={p}
            services={services ?? []}
            products={products ?? []}
            onEdit={() => setEditModal(p)}
            onDelete={() => remove(p.id)}
            onToggle={() => toggleAtivo(p)}
            onFidelidade={() => setFidelidadeModal(p)}
          />
        ))}
      </div>

      {/* Pick type modal */}
      <Modal open={pickModal} onClose={() => setPickModal(false)} title="Escolha o tipo de promoção" wide>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => {
            const hasAccess = PLAN_RANK[barbershop?.plan || 'silver'] >= RANK_LEVEL[t.rank];
            return (
              <button
                key={t.tipo}
                disabled={!hasAccess || t.disabled}
                onClick={() => { setNewTipo(t.tipo); setPickModal(false); }}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors relative overflow-hidden ${(!hasAccess || t.disabled) ? 'opacity-50 cursor-not-allowed bg-ink-900/50' : 'hover:bg-hover-soft'}`}
                style={{ borderColor: 'var(--border)' }}
              >
                <t.icon size={20} className={t.color} />
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {t.label}
                    {!hasAccess && (
                      <span className="text-[9px] bg-amber-500 text-ink-950 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">
                        Plano {t.rank === 'gold' ? 'Ouro' : 'Platina'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">{t.sub}</div>
                </div>
                {hasAccess && !t.disabled && <ChevronRight size={14} className="ml-auto text-muted shrink-0" />}
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Create form modal */}
      <Modal
        open={!!newTipo}
        onClose={() => setNewTipo(null)}
        title={`Nova promoção — ${TIPOS.find(t => t.tipo === newTipo)?.label ?? ''}`}
        wide
      >
        {newTipo && (
          <PromotionForm
            tipo={newTipo}
            initial={null}
            services={services ?? []}
            products={products ?? []}
            onSave={save}
          />
        )}
      </Modal>

      {/* Edit form modal */}
      <Modal
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={`Editar — ${editModal?.titulo ?? ''}`}
        wide
      >
        {editModal && (
          <PromotionForm
            tipo={editModal.tipo}
            initial={editModal}
            services={services ?? []}
            products={products ?? []}
            onSave={save}
          />
        )}
      </Modal>

      {/* Fidelidade tracker modal */}
      <Modal open={!!fidelidadeModal} onClose={() => setFidelidadeModal(null)} title="Fidelidade — progresso dos clientes" wide>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {(!clients || clients.length === 0) && (
            <p className="text-sm text-muted text-center py-8">Nenhum cliente acumulou pontos ainda.</p>
          )}
          {(clients ?? []).map((c: any) => {
            const meta = fidelidadeModal?.fidelidade_cortes ?? 10;
            const pct = Math.min(100, Math.round((c.cortes_acumulados / meta) * 100));
            const pronto = c.cortes_acumulados >= meta;
            return (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                  style={{ background: 'var(--border)' }}>
                  {c.clients?.nome?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{c.clients?.nome}</span>
                    <span className="text-xs text-muted">{c.cortes_acumulados}/{meta}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pronto ? '#22c55e' : 'var(--text)' }} />
                  </div>
                </div>
                {pronto && (
                  <button onClick={() => redeemFidelidade(c)} className="btn-primary text-xs px-3 py-1.5 gap-1 shrink-0">
                    <Check size={12} /> Resgatar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

/* ─── promotion card ─────────────────────────────────────────────── */
function PromotionCard({ promo, services, products, onEdit, onDelete, onToggle, onFidelidade }: {
  promo: Promotion;
  services: Pick<Service, 'id' | 'nome' | 'valor'>[];
  products: Pick<Product, 'id' | 'nome' | 'preco'>[];
  onEdit: () => void; onDelete: () => void; onToggle: () => void; onFidelidade: () => void;
}) {
  const meta = TIPOS.find(t => t.tipo === promo.tipo);
  const Icon = meta?.icon ?? Scissors;
  const color = meta?.color ?? 'text-muted';

  const summary = (() => {
    switch (promo.tipo) {
      case 'cashback': return `${promo.cashback_percentual}% de volta · válido por ${promo.cashback_validade_dias} dias`;
      case 'primeiro_corte': return `${promo.primeiro_corte_desconto}% de desconto na 1ª visita`;
      case 'aniversario': return `${promo.aniversario_desconto}% off · janela: ${promo.aniversario_janela}`;
      case 'fidelidade': return `Corte ${promo.fidelidade_cortes}x → próximo grátis`;
      case 'happy_hour': return `${promo.happy_hour_desconto}% off · ${(promo.happy_hour_dias ?? []).map(d => DIAS_SEMANA[d]).join(', ')} · ${promo.happy_hour_inicio?.slice(0,5)}–${promo.happy_hour_fim?.slice(0,5)}`;
      case 'dia_fixo': return `Toda ${DIAS_SEMANA[promo.dia_fixo_dia_semana]} · R$ ${Number(promo.dia_fixo_valor).toFixed(2)}`;
      case 'primeiro_horario': return `${promo.primeiro_horario_desconto}% off no slot das ${promo.primeiro_horario_slot?.slice(0,5)}`;
      case 'combo': {
        const nomes = (promo.combo_servico_ids ?? []).map(id => services.find(s => s.id === id)?.nome).filter(Boolean);
        return `${nomes.join(' + ')} · R$ ${Number(promo.combo_valor_fixo).toFixed(2)}`;
      }
      case 'retorno': return `${promo.retorno_desconto}% off ao retornar em até ${promo.retorno_dias} dias`;
      case 'pacote': return `${promo.pacote_cortes} cortes por R$ ${Number(promo.pacote_preco).toFixed(2)}`;
      case 'assinatura': return `${promo.assinatura_cortes_mes}x/mês · R$ ${Number(promo.assinatura_preco).toFixed(2)} · ${promo.assinatura_desconto_produtos}% off produtos`;
      case 'produto_servico': {
        const nomes = (promo.produto_ids ?? []).map(id => products.find(p => p.id === id)?.nome).filter(Boolean);
        return `${promo.produto_desconto}% off: ${nomes.join(', ') || 'produtos selecionados'}`;
      }
      default: return promo.descricao;
    }
  })();

  return (
    <div className={`card p-4 transition-opacity ${promo.ativo ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: 'var(--bg-hover)' }}>
          <Icon size={18} className={color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold">{promo.titulo}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: promo.ativo ? 'rgb(6 78 59 / 0.5)' : 'var(--bg-hover)', color: promo.ativo ? '#34d399' : 'var(--text-muted)' }}>
              {promo.ativo ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          <p className="text-xs text-muted">{meta?.label} · {summary}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {promo.tipo === 'fidelidade' && (
            <button onClick={onFidelidade} className="btn-ghost px-2 py-1.5 text-xs gap-1">
              <Trophy size={13} /> Ver progresso
            </button>
          )}
          <button onClick={onToggle} className="btn-ghost px-2 py-1.5 text-xs">
            {promo.ativo ? 'Desativar' : 'Ativar'}
          </button>
          <button onClick={onEdit} className="btn-ghost px-2 py-1.5"><Pencil size={13} /></button>
          <button onClick={onDelete} className="btn-ghost px-2 py-1.5 text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/* ─── promotion form (typed) ─────────────────────────────────────── */
function PromotionForm({ tipo, initial, services, products, onSave }: {
  tipo: PromotionTipo;
  initial: Promotion | null;
  services: Pick<Service, 'id' | 'nome' | 'valor'>[];
  products: Pick<Product, 'id' | 'nome' | 'preco'>[];
  onSave: (v: any) => void;
}) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? TIPOS.find(t => t.tipo === tipo)?.label ?? '');
  const [descricao, setDescricao] = useState(initial?.descricao ?? '');
  const [canal, setCanal] = useState(initial?.canal ?? 'whatsapp');
  const [mensagem, setMensagem] = useState(initial?.mensagem_personalizada ?? '');
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);

  // per-type state
  const [cashbackPct, setCashbackPct] = useState(Number(initial?.cashback_percentual ?? 5));
  const [cashbackValidade, setCashbackValidade] = useState(Number(initial?.cashback_validade_dias ?? 30));

  const [primeiroCorteDesc, setPrimeiroCorteDesc] = useState(Number(initial?.primeiro_corte_desconto ?? 20));

  const [anivJanela, setAnivJanela] = useState(initial?.aniversario_janela ?? 'dia');
  const [anivDesc, setAnivDesc] = useState(Number(initial?.aniversario_desconto ?? 20));

  const [fidelCortes, setFidelCortes] = useState(Number(initial?.fidelidade_cortes ?? 10));

  const [hhDias, setHhDias] = useState<number[]>(initial?.happy_hour_dias ?? [2, 3]);
  const [hhInicio, setHhInicio] = useState(initial?.happy_hour_inicio?.slice(0, 5) ?? '10:00');
  const [hhFim, setHhFim] = useState(initial?.happy_hour_fim?.slice(0, 5) ?? '14:00');
  const [hhDesc, setHhDesc] = useState(Number(initial?.happy_hour_desconto ?? 20));

  const [diaFixoDia, setDiaFixoDia] = useState(Number(initial?.dia_fixo_dia_semana ?? 2));
  const [diaFixoValor, setDiaFixoValor] = useState(Number(initial?.dia_fixo_valor ?? 0));

  const [phDesc, setPhDesc] = useState(Number(initial?.primeiro_horario_desconto ?? 15));
  const [phSlot, setPhSlot] = useState(initial?.primeiro_horario_slot?.slice(0, 5) ?? '08:00');

  const [comboIds, setComboIds] = useState<string[]>(initial?.combo_servico_ids ?? []);
  const [comboValor, setComboValor] = useState(Number(initial?.combo_valor_fixo ?? 0));

  const [retornoDias, setRetornoDias] = useState(Number(initial?.retorno_dias ?? 21));
  const [retornoDesc, setRetornoDesc] = useState(Number(initial?.retorno_desconto ?? 15));

  const [pacoteCortes, setPacoteCortes] = useState(Number(initial?.pacote_cortes ?? 5));
  const [pacotePreco, setPacotePreco] = useState(Number(initial?.pacote_preco ?? 0));

  const [assCortes, setAssCortes] = useState(Number(initial?.assinatura_cortes_mes ?? 2));
  const [assPreco, setAssPreco] = useState(Number(initial?.assinatura_preco ?? 0));
  const [assDescProd, setAssDescProd] = useState(Number(initial?.assinatura_desconto_produtos ?? 10));

  const [prodIds, setProdIds] = useState<string[]>(initial?.produto_ids ?? []);
  const [prodDesc, setProdDesc] = useState(Number(initial?.produto_desconto ?? 20));

  const toggleDay = (d: number) =>
    setHhDias(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const toggleCombo = (id: string) =>
    setComboIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleProd = (id: string) =>
    setProdIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      tipo, titulo, descricao, canal, mensagem_personalizada: mensagem, ativo,
      cashback_percentual: cashbackPct, cashback_validade_dias: cashbackValidade,
      primeiro_corte_desconto: primeiroCorteDesc,
      aniversario_janela: anivJanela, aniversario_desconto: anivDesc,
      fidelidade_cortes: fidelCortes,
      happy_hour_dias: hhDias, happy_hour_inicio: hhInicio, happy_hour_fim: hhFim, happy_hour_desconto: hhDesc,
      dia_fixo_dia_semana: diaFixoDia, dia_fixo_valor: diaFixoValor,
      primeiro_horario_desconto: phDesc, primeiro_horario_slot: phSlot,
      combo_servico_ids: comboIds, combo_valor_fixo: comboValor,
      retorno_dias: retornoDias, retorno_desconto: retornoDesc,
      pacote_cortes: pacoteCortes, pacote_preco: pacotePreco,
      assinatura_cortes_mes: assCortes, assinatura_preco: assPreco, assinatura_desconto_produtos: assDescProd,
      produto_ids: prodIds, produto_desconto: prodDesc,
    });
  };

  const combo_soma = comboIds.reduce((acc, id) => acc + (services.find(s => s.id === id)?.valor ?? 0), 0);

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* common */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Título</label>
          <input className="input" value={titulo} onChange={e => setTitulo(e.target.value)} required autoFocus />
        </div>
        <div className="col-span-2">
          <label className="label">Descrição (opcional)</label>
          <input className="input" value={descricao} onChange={e => setDescricao(e.target.value)} />
        </div>
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* ── cashback ── */}
      {tipo === 'cashback' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">% de cashback por corte</label>
            <input className="input" type="number" min={1} max={100} step={0.5} value={cashbackPct} onChange={e => setCashbackPct(+e.target.value)} />
          </div>
          <div>
            <label className="label">Validade do saldo (dias)</label>
            <input className="input" type="number" min={1} value={cashbackValidade} onChange={e => setCashbackValidade(+e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-muted">O barbeiro deve abater o saldo manualmente ao fechar o atendimento. O saldo fica visível no perfil do cliente.</p>
        </div>
      )}

      {/* ── primeiro corte ── */}
      {tipo === 'primeiro_corte' && (
        <div>
          <label className="label">Desconto na 1ª visita (%)</label>
          <input className="input" type="number" min={1} max={100} step={0.5} value={primeiroCorteDesc} onChange={e => setPrimeiroCorteDesc(+e.target.value)} />
          <p className="text-xs text-muted mt-1">Aplicado automaticamente quando o cliente nunca teve um pedido fechado.</p>
        </div>
      )}

      {/* ── aniversário ── */}
      {tipo === 'aniversario' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Desconto (%)</label>
            <input className="input" type="number" min={1} max={100} step={0.5} value={anivDesc} onChange={e => setAnivDesc(+e.target.value)} />
          </div>
          <div>
            <label className="label">Janela de validade</label>
            <select className="input" value={anivJanela} onChange={e => setAnivJanela(e.target.value)}>
              <option value="dia">Somente no dia</option>
              <option value="semana">Na semana do aniversário</option>
              <option value="mes">No mês do aniversário</option>
            </select>
          </div>
          <p className="col-span-2 text-xs text-muted">Requer data de aniversário preenchida no cadastro do cliente.</p>
        </div>
      )}

      {/* ── fidelidade ── */}
      {tipo === 'fidelidade' && (
        <div>
          <label className="label">Número de cortes para ganhar o próximo grátis</label>
          <input className="input" type="number" min={2} max={50} value={fidelCortes} onChange={e => setFidelCortes(+e.target.value)} />
          <p className="text-xs text-muted mt-1">Após o resgate, a contagem reinicia do zero. Use o botão "Ver progresso" para resgatar manualmente.</p>
        </div>
      )}

      {/* ── happy hour ── */}
      {tipo === 'happy_hour' && (
        <div className="space-y-3">
          <div>
            <label className="label">Dias da semana</label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {DIAS_SEMANA.map((d, i) => (
                <button key={i} type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${hhDias.includes(i) ? 'border-current' : 'border-transparent'}`}
                  style={hhDias.includes(i) ? { background: 'var(--text)', color: 'var(--bg)' } : { background: 'var(--bg-hover)' }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Das</label>
              <input className="input" type="time" value={hhInicio} onChange={e => setHhInicio(e.target.value)} />
            </div>
            <div>
              <label className="label">Até</label>
              <input className="input" type="time" value={hhFim} onChange={e => setHhFim(e.target.value)} />
            </div>
            <div>
              <label className="label">Desconto (%)</label>
              <input className="input" type="number" min={1} max={100} step={0.5} value={hhDesc} onChange={e => setHhDesc(+e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted">Válido apenas para agendamentos online neste horário.</p>
        </div>
      )}

      {/* ── dia fixo ── */}
      {tipo === 'dia_fixo' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Dia da semana</label>
            <select className="input" value={diaFixoDia} onChange={e => setDiaFixoDia(+e.target.value)}>
              {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Valor promocional (R$)</label>
            <input className="input" type="number" min={0} step={0.01} value={diaFixoValor} onChange={e => setDiaFixoValor(+e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-muted">Cria hábito de meio de semana e preenche horários ociosos.</p>
        </div>
      )}

      {/* ── primeiro horário ── */}
      {tipo === 'primeiro_horario' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Horário (slot)</label>
            <input className="input" type="time" value={phSlot} onChange={e => setPhSlot(e.target.value)} />
          </div>
          <div>
            <label className="label">Desconto (%)</label>
            <input className="input" type="number" min={1} max={100} step={0.5} value={phDesc} onChange={e => setPhDesc(+e.target.value)} />
          </div>
        </div>
      )}

      {/* ── combo ── */}
      {tipo === 'combo' && (
        <div className="space-y-3">
          <div>
            <label className="label">Serviços do combo</label>
            <div className="space-y-1 mt-1 max-h-48 overflow-y-auto pr-1">
              {services.map(s => (
                <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-hover-soft transition-colors text-sm"
                  style={{ background: comboIds.includes(s.id) ? 'var(--bg-hover)' : undefined }}>
                  <input type="checkbox" checked={comboIds.includes(s.id)} onChange={() => toggleCombo(s.id)} />
                  <span className="flex-1">{s.nome}</span>
                  <span className="text-muted">R$ {Number(s.valor).toFixed(2)}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Valor do combo (R$)</label>
            <input className="input" type="number" min={0} step={0.01} value={comboValor} onChange={e => setComboValor(+e.target.value)} />
          </div>
          {combo_soma > 0 && comboValor > 0 && (
            <p className="text-xs text-muted">
              Valor separado: R$ {combo_soma.toFixed(2)} · Economia: <span className="text-emerald-400 font-medium">R$ {(combo_soma - comboValor).toFixed(2)}</span>
            </p>
          )}
        </div>
      )}

      {/* ── retorno ── */}
      {tipo === 'retorno' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Retornar em até (dias)</label>
            <input className="input" type="number" min={1} value={retornoDias} onChange={e => setRetornoDias(+e.target.value)} />
          </div>
          <div>
            <label className="label">Desconto (%)</label>
            <input className="input" type="number" min={1} max={100} step={0.5} value={retornoDesc} onChange={e => setRetornoDesc(+e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-muted">O sistema envia a mensagem {retornoDias - 3 > 0 ? retornoDias - 3 : 1} dias após o corte convidando o cliente a retornar.</p>
        </div>
      )}

      {/* ── pacote ── */}
      {tipo === 'pacote' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantidade de cortes</label>
            <input className="input" type="number" min={2} value={pacoteCortes} onChange={e => setPacoteCortes(+e.target.value)} />
          </div>
          <div>
            <label className="label">Preço total do pacote (R$)</label>
            <input className="input" type="number" min={0} step={0.01} value={pacotePreco} onChange={e => setPacotePreco(+e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-muted">Ex: {pacoteCortes} cortes por R$ {pacotePreco.toFixed(2)} pago adiantado. Gera receita antecipada e fideliza o cliente.</p>
        </div>
      )}

      {/* ── assinatura ── */}
      {tipo === 'assinatura' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Cortes por mês</label>
            <input className="input" type="number" min={1} value={assCortes} onChange={e => setAssCortes(+e.target.value)} />
          </div>
          <div>
            <label className="label">Mensalidade (R$)</label>
            <input className="input" type="number" min={0} step={0.01} value={assPreco} onChange={e => setAssPreco(+e.target.value)} />
          </div>
          <div>
            <label className="label">Desconto em produtos (%)</label>
            <input className="input" type="number" min={0} max={100} step={0.5} value={assDescProd} onChange={e => setAssDescProd(+e.target.value)} />
          </div>
        </div>
      )}

      {/* ── produto + serviço ── */}
      {tipo === 'produto_servico' && (
        <div className="space-y-3">
          <div>
            <label className="label">Desconto no produto (%)</label>
            <input className="input" type="number" min={1} max={100} step={0.5} value={prodDesc} onChange={e => setProdDesc(+e.target.value)} />
          </div>
          <div>
            <label className="label">Produtos elegíveis</label>
            <div className="space-y-1 mt-1 max-h-48 overflow-y-auto pr-1">
              {products.map(p => (
                <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer hover:bg-hover-soft transition-colors text-sm"
                  style={{ background: prodIds.includes(p.id) ? 'var(--bg-hover)' : undefined }}>
                  <input type="checkbox" checked={prodIds.includes(p.id)} onChange={() => toggleProd(p.id)} />
                  <span className="flex-1">{p.nome}</span>
                  <span className="text-muted">R$ {Number(p.preco).toFixed(2)}</span>
                </label>
              ))}
              {products.length === 0 && <p className="text-xs text-muted px-1">Nenhum produto ativo cadastrado.</p>}
            </div>
          </div>
        </div>
      )}

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* notification */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Canal de comunicação</label>
          <select className="input" value={canal} onChange={e => setCanal(e.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">E-mail</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Mensagem (opcional)</label>
          <textarea className="input" rows={3} value={mensagem} onChange={e => setMensagem(e.target.value)}
            placeholder="Olá {nome}! Você tem uma promoção esperando por você…" />
          <p className="text-xs text-muted mt-1">Use <code className="px-1 rounded" style={{ background: 'var(--bg-hover)' }}>{'{nome}'}</code> para o nome do cliente.</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
        <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} /> Promoção ativa
      </label>

      <button className="btn-primary w-full">Salvar promoção</button>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <Scissors size={32} className="mx-auto text-muted mb-3" />
      <p className="text-sm font-medium">Nenhuma promoção criada</p>
      <p className="text-xs text-muted mt-1 max-w-sm mx-auto">Escolha um tipo de promoção e comece a fidelizar seus clientes.</p>
    </div>
  );
}

function Skeleton() {
  return (
    <>{[...Array(3)].map((_, i) => (
      <div key={i} className="card p-4 animate-pulse flex gap-3">
        <div className="w-10 h-10 rounded-lg shrink-0" style={{ background: 'var(--bg-hover)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 rounded w-1/4" style={{ background: 'var(--bg-hover)' }} />
          <div className="h-2.5 rounded w-1/2" style={{ background: 'var(--bg-hover)' }} />
        </div>
      </div>
    ))}</>
  );
}
