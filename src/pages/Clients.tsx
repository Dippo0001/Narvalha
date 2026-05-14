import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import {
  Plus, Search, User, Bell, Pencil, Trash2,
  MessageCircle, Mail, Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays } from 'date-fns';
import type { Client } from '../types/db';

type Tab = 'clientes' | 'lembretes';

interface Reminder {
  id: string; barbershop_id: string; client_id: string | null; titulo: string;
  mensagem: string; dias_sem_visita: number; canal: string; ativo: boolean;
}

const CANAL_ICON: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle, email: Mail, sms: Smartphone,
};

export default function Clients() {
  const [tab, setTab] = useState<Tab>('clientes');
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader title="Clientes" />
      <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'clientes', label: 'Clientes', icon: User },
          { key: 'lembretes', label: 'Lembretes', icon: Bell },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm -mb-px border-b-2 transition-colors
              ${tab === key ? 'border-current font-medium' : 'border-transparent text-muted hover:text-current'}`}
            style={tab === key ? { borderColor: 'var(--text)' } : {}}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {tab === 'clientes' && <ClientsTab />}
      {tab === 'lembretes' && <RemindersTab />}
    </div>
  );
}

import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/* ──────────────────────────── CLIENTES ──────────────────────────── */
function ClientsTab() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Client | 'new' | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', barbershop?.id, search],
    enabled: !!barbershop,
    queryFn: async () => {
      let q = supabase.from('clients').select('*').eq('barbershop_id', barbershop!.id).order('nome');
      if (search) q = q.or(`nome.ilike.%${search}%,telefone.ilike.%${search}%`);
      const { data } = await q.limit(100);
      return (data ?? []) as Client[];
    },
  });

  const save = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new'
      ? await supabase.from('clients').insert(payload)
      : await supabase.from('clients').update(payload).eq('id', (modal as Client).id);
    if (error) return toast.error(error.message);
    toast.success('Cliente salvo');
    qc.invalidateQueries({ queryKey: ['clients'] });
    setModal(null);
  };

  const sendReminder = (c: Client) => {
    const msg = `Olá ${c.nome}! 👋 Faz um tempo que não te vemos na barbearia. Que tal agendar um horário para renovar o visual?`;
    const wa = `https://wa.me/${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
    window.open(wa, '_blank');
  };

  return (
    <>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Buscar por nome ou telefone" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Novo cliente</button>
      </div>

      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {isLoading && <SkeletonRows />}
        {!isLoading && (!clients || clients.length === 0) && (
          <Empty icon={User} text="Nenhum cliente cadastrado" />
        )}
        {(clients ?? []).map((c) => {
          const diasSemVisita = c.ultima_visita ? differenceInDays(new Date(), new Date(c.ultima_visita)) : null;
          const isAtrasado = diasSemVisita !== null && diasSemVisita >= c.lembrete_dias;

          return (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-hover-soft transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                  style={{ background: 'var(--bg-hover)' }}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{c.nome}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="text-xs text-muted">{c.telefone || 'Sem telefone'}</span>
                    {c.ultima_visita && (
                      <span className={`text-[10px] ${isAtrasado ? 'text-amber-400 font-medium' : 'text-muted'}`}>
                        Última visita: {format(new Date(c.ultima_visita), 'dd/MM/yyyy')} 
                        {diasSemVisita !== null && ` (${diasSemVisita} dias)`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => sendReminder(c)} 
                  className={`btn-ghost px-2 py-1.5 flex items-center gap-1.5 text-xs ${isAtrasado ? 'text-amber-400 border border-amber-400/20 bg-amber-400/5' : ''}`}
                  title="Enviar lembrete WhatsApp"
                >
                  <MessageCircle size={13} />
                  <span className="hidden sm:inline">Lembrete</span>
                </button>
                <button onClick={() => setModal(c)} className="btn-ghost px-2 py-1.5"><Pencil size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Novo cliente' : 'Editar cliente'}>
        <ClientForm initial={modal === 'new' ? null : (modal as Client)} onSave={save} />
      </Modal>
    </>
  );
}

function ClientForm({ initial, onSave }: { initial: Client | null; onSave: (v: any) => void }) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [telefone, setTelefone] = useState(initial?.telefone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [obs, setObs] = useState(initial?.observacoes ?? '');
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [lembreteDias, setLembreteDias] = useState(initial?.lembrete_dias ?? 30);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ 
      nome, 
      telefone, 
      email, 
      observacoes: obs, 
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      lembrete_dias: lembreteDias 
    }); }}
      className="space-y-4">
      <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Telefone</label><input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} required /></div>
        <div>
          <label className="label">Ciclo de Retorno (Dias)</label>
          <select className="input" value={lembreteDias} onChange={(e) => setLembreteDias(+e.target.value)}>
            <option value={15}>15 dias</option>
            <option value={30}>30 dias</option>
            <option value={45}>45 dias</option>
            <option value={60}>60 dias</option>
            <option value={120}>120 dias</option>
          </select>
        </div>
      </div>
      <div><label className="label">E-mail</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label">Tags (separadas por vírgula)</label><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, aniversariante" /></div>
      <div><label className="label">Observações</label><textarea className="input" rows={3} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
      <button className="btn-primary w-full">Salvar</button>
    </form>
  );
}

/* ──────────────────────────── LEMBRETES ──────────────────────────── */
function RemindersTab() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<Reminder | 'new' | null>(null);

  const { data: reminders, isLoading } = useQuery({
    queryKey: ['reminders', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('client_reminders').select('*')
        .eq('barbershop_id', barbershop!.id).order('dias_sem_visita');
      return (data ?? []) as Reminder[];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-for-reminder', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id,nome').eq('barbershop_id', barbershop!.id).order('nome');
      return (data ?? []) as Pick<Client, 'id' | 'nome'>[];
    },
  });

  const { data: due } = useQuery({
    queryKey: ['reminders-due', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data: appts } = await supabase.from('appointments')
        .select('client_id, data_hora, clients(nome, telefone)')
        .eq('barbershop_id', barbershop!.id).eq('status', 'finalizado')
        .order('data_hora', { ascending: false });
      const lastVisit = new Map<string, { nome: string; telefone: string; data_hora: string }>();
      (appts ?? []).forEach((a: any) => {
        if (!lastVisit.has(a.client_id)) {
          lastVisit.set(a.client_id, { nome: a.clients?.nome, telefone: a.clients?.telefone, data_hora: a.data_hora });
        }
      });
      return lastVisit;
    },
  });

  const dueClients = (reminders ?? []).flatMap((r) => {
    const results: { client: string; telefone: string; reminder: Reminder; dias: number }[] = [];
    due?.forEach((v, cid) => {
      if (r.client_id && r.client_id !== cid) return;
      const dias = differenceInDays(new Date(), new Date(v.data_hora));
      if (dias >= r.dias_sem_visita && r.ativo) {
        results.push({ client: v.nome, telefone: v.telefone, reminder: r, dias });
      }
    });
    return results;
  });

  const save = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new'
      ? await supabase.from('client_reminders').insert(payload)
      : await supabase.from('client_reminders').update(payload).eq('id', (modal as Reminder).id);
    if (error) return toast.error(error.message);
    toast.success('Lembrete salvo');
    qc.invalidateQueries({ queryKey: ['reminders', 'reminders-due'] });
    setModal(null);
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir este lembrete?')) return;
    await supabase.from('client_reminders').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['reminders'] });
  };

  return (
    <>
      {dueClients.length > 0 && (
        <div className="card p-4 mb-5 border-l-4" style={{ borderLeftColor: '#f59e0b' }}>
          <div className="flex items-center gap-2 mb-3">
            <Bell size={15} className="text-amber-400" />
            <span className="text-sm font-medium">{dueClients.length} cliente{dueClients.length > 1 ? 's' : ''} para contatar hoje</span>
          </div>
          <div className="space-y-2">
            {dueClients.map((d, i) => {
              const wa = `https://wa.me/${d.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(d.reminder.mensagem.replace('{nome}', d.client))}`;
              return (
                <div key={i} className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: 'var(--bg-hover)' }}>
                  <div>
                    <span className="text-sm font-medium">{d.client}</span>
                    <span className="text-xs text-muted ml-2">· {d.dias} dias sem visita</span>
                  </div>
                  <a href={wa} target="_blank" rel="noreferrer" className="btn-outline text-xs px-3 py-1.5 gap-1.5">
                    <MessageCircle size={12} /> WhatsApp
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button className="btn-primary" onClick={() => setModal('new')}><Plus size={15} /> Novo lembrete</button>
      </div>

      <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
        {isLoading && <SkeletonRows />}
        {!isLoading && (!reminders || reminders.length === 0) && (
          <Empty icon={Bell} text="Nenhum lembrete configurado" sub="Crie lembretes automáticos para reativar clientes que pararam de visitar." />
        )}
        {(reminders ?? []).map((r) => {
          const CanalIcon = CANAL_ICON[r.canal] ?? MessageCircle;
          const cliente = clients?.find(c => c.id === r.client_id);
          return (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3 hover:bg-hover-soft transition-colors">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--bg-hover)' }}>
                <Bell size={15} className={r.ativo ? '' : 'text-muted'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.titulo}</div>
                <div className="text-xs text-muted mt-0.5">
                  Após <strong>{r.dias_sem_visita} dias</strong> sem visita
                  {cliente ? ` · para ${cliente.nome}` : ' · todos os clientes'}
                  {!r.ativo && ' · inativo'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <CanalIcon size={14} className="text-muted" />
                <span className="text-xs text-muted capitalize">{r.canal}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setModal(r)} className="btn-ghost px-2 py-1.5"><Pencil size={13} /></button>
                <button onClick={() => remove(r.id)} className="btn-ghost px-2 py-1.5 text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Novo lembrete' : 'Editar lembrete'}>
        {modal !== null && (
          <ReminderForm initial={modal === 'new' ? null : (modal as Reminder)} clients={clients ?? []} onSave={save} />
        )}
      </Modal>
    </>
  );
}

function ReminderForm({ initial, clients, onSave }: {
  initial: Reminder | null;
  clients: Pick<Client, 'id' | 'nome'>[];
  onSave: (v: any) => void;
}) {
  const [form, setForm] = useState({
    titulo: initial?.titulo ?? '',
    mensagem: initial?.mensagem ?? 'Olá {nome}! Faz um tempo que não te vemos por aqui. Que tal agendar um horário?',
    dias_sem_visita: initial?.dias_sem_visita ?? 30,
    canal: initial?.canal ?? 'whatsapp',
    client_id: initial?.client_id ?? '',
    ativo: initial?.ativo ?? true,
  });
  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, client_id: form.client_id || null }); }} className="space-y-4">
      <div>
        <label className="label">Título</label>
        <input className="input" value={form.titulo} onChange={e => f('titulo', e.target.value)} required autoFocus placeholder="Ex: Retorno — 30 dias" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Notificar após (dias sem visita)</label>
          <input className="input" type="number" min={1} value={form.dias_sem_visita} onChange={e => f('dias_sem_visita', +e.target.value)} required />
        </div>
        <div>
          <label className="label">Canal</label>
          <select className="input" value={form.canal} onChange={e => f('canal', e.target.value)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">E-mail</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Para qual cliente</label>
        <select className="input" value={form.client_id} onChange={e => f('client_id', e.target.value)}>
          <option value="">Todos os clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Mensagem</label>
        <textarea className="input" rows={4} value={form.mensagem} onChange={e => f('mensagem', e.target.value)} />
        <p className="text-xs text-muted mt-1">Use <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--bg-hover)' }}>{'{nome}'}</code> para o nome do cliente.</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
        <input type="checkbox" checked={form.ativo} onChange={e => f('ativo', e.target.checked)} className="rounded" />
        Lembrete ativo
      </label>
      <button className="btn-primary w-full">Salvar lembrete</button>
    </form>
  );
}

/* ──────────────────────────── helpers ──────────────────────────── */
function SkeletonRows() {
  return (
    <>{[...Array(4)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
        <div className="w-9 h-9 rounded-full" style={{ background: 'var(--bg-hover)' }} />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 rounded w-1/3" style={{ background: 'var(--bg-hover)' }} />
          <div className="h-2.5 rounded w-1/5" style={{ background: 'var(--bg-hover)' }} />
        </div>
      </div>
    ))}</>
  );
}

function Empty({ icon: Icon, text, sub }: { icon: any; text: string; sub?: string }) {
  return (
    <div className="p-12 text-center">
      <Icon size={32} className="mx-auto text-muted mb-3" />
      <p className="text-sm font-medium">{text}</p>
      {sub && <p className="text-xs text-muted mt-1 max-w-xs mx-auto">{sub}</p>}
    </div>
  );
}
