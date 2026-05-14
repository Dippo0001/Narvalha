import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { addDays, addMinutes, format, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { Appointment, Barber, Client, Service } from '../types/db';

const SLOT_MIN = 15;
const START_HOUR = 8;
const END_HOUR = 21;

const STATUS_STYLES: Record<string, string> = {
  agendado: 'bg-ink-700 text-ink-100',
  confirmado: 'bg-ink-50 text-ink-950',
  em_atendimento: 'bg-ink-700 text-ink-50 border border-ink-300',
  finalizado: 'bg-transparent text-ink-400 border border-ink-600',
  cancelado: 'bg-ink-800 text-ink-500 line-through',
  no_show: 'bg-red-900/40 text-red-300',
};

export default function Schedule() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [barberFilter, setBarberFilter] = useState<string>('all');
  const [slotModal, setSlotModal] = useState<{ barber_id: string; time: Date } | null>(null);
  const [apptModal, setApptModal] = useState<Appointment | null>(null);

  const { data: barbers } = useQuery({
    queryKey: ['barbers-list', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('barbers').select('*').eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome_exibicao');
      return (data ?? []) as Barber[];
    },
  });

  const { data: appts } = useQuery({
    queryKey: ['appts', barbershop?.id, day.toISOString()],
    enabled: !!barbershop,
    queryFn: async () => {
      const start = startOfDay(day).toISOString();
      const end = addDays(startOfDay(day), 1).toISOString();
      const { data } = await supabase.from('appointments')
        .select('*, clients(nome,telefone), appointment_services(service_id, services(nome))')
        .eq('barbershop_id', barbershop!.id).gte('data_hora', start).lt('data_hora', end)
        .order('data_hora');
      return (data ?? []) as (Appointment & { clients: any; appointment_services: any[] })[];
    },
  });

  const visibleBarbers = useMemo(
    () => (barbers ?? []).filter((b) => barberFilter === 'all' || b.id === barberFilter),
    [barbers, barberFilter]
  );

  const slots = useMemo(() => {
    const r: Date[] = [];
    const base = startOfDay(day);
    for (let h = START_HOUR; h < END_HOUR; h++) {
      for (let m = 0; m < 60; m += SLOT_MIN) {
        r.push(addMinutes(base, h * 60 + m));
      }
    }
    return r;
  }, [day]);

  const apptsByBarber = useMemo(() => {
    const m: Record<string, typeof appts> = {};
    (appts ?? []).forEach((a) => { (m[a.barber_id] ||= [] as any).push(a); });
    return m;
  }, [appts]);

  const startAttendance = async (appt: Appointment & any) => {
    if (!barbershop) return;
    const { data: existing } = await supabase.from('orders').select('id').eq('appointment_id', appt.id).eq('status', 'aberta').maybeSingle();
    if (existing) { nav(`/atendimento/${existing.id}`); return; }
    const { data: order, error } = await supabase.from('orders').insert({
      barbershop_id: barbershop.id, appointment_id: appt.id, client_id: appt.client_id,
      barber_id: appt.barber_id, total: 0, desconto: 0, status: 'aberta',
    }).select('id').single();
    if (error) return toast.error(error.message);
    // preload services
    if (appt.appointment_services?.length) {
      const { data: services } = await supabase.from('services').select('*').in('id', appt.appointment_services.map((s: any) => s.service_id));
      const items = (services ?? []).map((s: Service) => ({
        order_id: order.id, tipo: 'servico', ref_id: s.id, descricao: s.nome,
        qtd: 1, valor_unit: s.valor, valor_total: s.valor, comissao_percentual: 0, comissao_valor: 0,
      }));
      if (items.length) await supabase.from('order_items').insert(items);
      const total = items.reduce((sum, i) => sum + Number(i.valor_total), 0);
      await supabase.from('orders').update({ total }).eq('id', order.id);
    }
    await supabase.from('appointments').update({ status: 'em_atendimento' }).eq('id', appt.id);
    nav(`/atendimento/${order.id}`);
  };

  const cancel = async (appt: Appointment) => {
    if (!confirm('Cancelar este agendamento?')) return;
    const { error } = await supabase.from('appointments').update({ status: 'cancelado' }).eq('id', appt.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['appts'] });
    setApptModal(null);
  };

  return (
    <div className="p-4 flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      <PageHeader title="Agenda" subtitle={format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        actions={
          <div className="flex flex-wrap gap-2">
            <select className="input input-sm w-auto" value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)}>
              <option value="all">Todos</option>
              {(barbers ?? []).map((b) => <option key={b.id} value={b.id}>{b.nome_exibicao}</option>)}
            </select>
            <div className="flex gap-1">
              <button className="btn-ghost btn-xs" onClick={() => setDay(addDays(day, -1))}><ChevronLeft size={14} /></button>
              <button className="btn-outline btn-xs" onClick={() => setDay(startOfDay(new Date()))}>Hoje</button>
              <button className="btn-ghost btn-xs" onClick={() => setDay(addDays(day, 1))}><ChevronRight size={14} /></button>
            </div>
          </div>
        } />

      <div className="card flex-1 flex flex-col overflow-hidden">
        {/* Header de Barbeiros - Fixo no topo */}
        <div className="grid border-b border-ink-800 bg-ink-900/50" style={{ gridTemplateColumns: `60px repeat(${visibleBarbers.length}, minmax(120px, 1fr))` }}>
          <div className="p-2 border-r border-ink-800"></div>
          {visibleBarbers.map((b) => (
            <div key={b.id} className="p-2 text-xs font-bold text-ink-300 text-center border-r border-ink-800 last:border-r-0 truncate">
              {b.nome_exibicao}
            </div>
          ))}
        </div>

        {/* Grade de Horários - Rolável */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="grid relative" style={{ gridTemplateColumns: `60px repeat(${visibleBarbers.length}, minmax(120px, 1fr))` }}>
            {slots.map((t, i) => {
              const showLabel = t.getMinutes() === 0;
              const isHourStart = t.getMinutes() === 0;
              
              return (
                <div key={i} className="contents">
                  <div className={`px-1 py-0.5 text-[10px] text-ink-500 text-right border-r border-ink-800 flex items-center justify-end h-7 ${isHourStart ? 'bg-ink-900/30' : ''}`}>
                    {showLabel ? format(t, 'HH:mm') : ''}
                  </div>
                  {visibleBarbers.map((b) => {
                    const apptHere = (apptsByBarber[b.id] ?? []).find((a: any) => {
                      const start = parseISO(a.data_hora);
                      const end = addMinutes(start, a.duracao_min);
                      return t >= start && t < end;
                    });
                    const isStart = apptHere && format(parseISO((apptHere as any).data_hora), 'HH:mm') === format(t, 'HH:mm');
                    
                    return (
                      <div key={b.id} className={`border-b border-r border-ink-800 h-7 relative group last:border-r-0 ${isHourStart ? 'bg-ink-900/10' : ''}`}>
                        {!apptHere && (
                          <button
                            onClick={() => setSlotModal({ barber_id: b.id, time: t })}
                            className="absolute inset-0 hover:bg-ink-500/10 transition-colors"
                          >
                            <Plus size={10} className="absolute top-1 right-1 text-ink-600 opacity-0 group-hover:opacity-100" />
                          </button>
                        )}
                        {apptHere && isStart && (
                          <button
                            onClick={() => setApptModal(apptHere as any)}
                            className={`absolute inset-x-0.5 top-0.5 px-1.5 py-0.5 rounded shadow-sm text-[10px] text-left overflow-hidden z-10 hover:brightness-110 transition-all ${STATUS_STYLES[(apptHere as any).status]}`}
                            style={{ height: `${((apptHere as any).duracao_min / SLOT_MIN) * 28 - 4}px` }}
                          >
                            <div className="font-bold truncate leading-tight">{(apptHere as any).clients?.nome ?? '—'}</div>
                            { (apptHere as any).duracao_min >= 30 && (
                              <div className="opacity-80 truncate text-[9px] leading-tight mt-0.5">
                                {(apptHere as any).appointment_services?.map((s: any) => s.services?.nome).filter(Boolean).join(', ')}
                              </div>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal open={!!slotModal} onClose={() => setSlotModal(null)} title="Novo agendamento">
        {slotModal && <NewApptForm slot={slotModal} onClose={() => { setSlotModal(null); qc.invalidateQueries({ queryKey: ['appts'] }); }} />}
      </Modal>

      <Modal open={!!apptModal} onClose={() => setApptModal(null)} title="Agendamento">
        {apptModal && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-lg text-ink-50">{(apptModal as any).clients?.nome}</div>
              <div className="text-sm text-ink-400">{format(parseISO(apptModal.data_hora), "dd/MM 'às' HH:mm")} · {apptModal.duracao_min} min</div>
              <div className="text-xs text-ink-500">Status: {apptModal.status}</div>
            </div>
            <div className="flex gap-2">
              {apptModal.status !== 'finalizado' && apptModal.status !== 'cancelado' && (
                <button className="btn-primary flex-1" onClick={() => startAttendance(apptModal as any)}>Iniciar atendimento</button>
              )}
              <button className="btn-outline" onClick={() => cancel(apptModal)}>Cancelar</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function NewApptForm({ slot, onClose }: { slot: { barber_id: string; time: Date }; onClose: () => void }) {
  const { barbershop } = useAuth();
  const [clientQuery, setClientQuery] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  const { data: clients } = useQuery({
    queryKey: ['clients-search', barbershop?.id, clientQuery],
    enabled: !!barbershop && clientQuery.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('*').eq('barbershop_id', barbershop!.id)
        .or(`nome.ilike.%${clientQuery}%,telefone.ilike.%${clientQuery}%`).limit(5);
      return (data ?? []) as Client[];
    },
  });

  const { data: services } = useQuery({
    queryKey: ['svc-active', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('barbershop_id', barbershop!.id).eq('ativo', true).order('ordem');
      return (data ?? []) as Service[];
    },
  });

  const totalDuration = useMemo(() =>
    (services ?? []).filter((s) => serviceIds.includes(s.id)).reduce((sum, s) => sum + s.duracao_min, 0) || 30,
    [services, serviceIds]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershop) return;
    let cid = clientId;
    if (!cid) {
      if (!newClientName || !newClientPhone) return toast.error('Cliente é obrigatório');
      const { data: c, error } = await supabase.from('clients').insert({
        barbershop_id: barbershop.id, nome: newClientName, telefone: newClientPhone,
      }).select('id').single();
      if (error) return toast.error(error.message);
      cid = c.id;
    }
    const { data: appt, error } = await supabase.from('appointments').insert({
      barbershop_id: barbershop.id, client_id: cid, barber_id: slot.barber_id,
      data_hora: slot.time.toISOString(), duracao_min: totalDuration, status: 'agendado', origem: 'manual',
    }).select('id').single();
    if (error) return toast.error(error.message);
    if (serviceIds.length) {
      await supabase.from('appointment_services').insert(serviceIds.map((sid) => ({ appointment_id: appt.id, service_id: sid })));
    }
    toast.success('Agendamento criado');
    onClose();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-sm text-ink-400">
        {format(slot.time, "dd/MM 'às' HH:mm", { locale: ptBR })}
      </div>
      <div>
        <label className="label">Cliente</label>
        {!clientId ? (
          <>
            <input className="input mb-2" placeholder="Buscar cliente por nome ou telefone"
              value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} />
            {(clients ?? []).length > 0 && (
              <div className="card p-1 mb-2 max-h-32 overflow-auto">
                {(clients ?? []).map((c) => (
                  <button type="button" key={c.id} onClick={() => { setClientId(c.id); setClientQuery(c.nome); }}
                    className="w-full text-left p-2 rounded hover:bg-ink-800 text-sm text-ink-100">
                    {c.nome} <span className="text-ink-500">· {c.telefone}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-ink-500 mb-2">Ou cadastre rapidamente:</p>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Nome" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
              <input className="input" placeholder="Telefone" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between p-2 card"><span className="text-sm">{clientQuery}</span>
            <button type="button" className="text-xs text-ink-500" onClick={() => { setClientId(null); setClientQuery(''); }}>trocar</button>
          </div>
        )}
      </div>
      <div>
        <label className="label">Serviços</label>
        <div className="space-y-1 max-h-40 overflow-auto">
          {(services ?? []).map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm text-ink-200 p-2 hover:bg-ink-800/40 rounded cursor-pointer">
              <input type="checkbox" checked={serviceIds.includes(s.id)}
                onChange={(e) => setServiceIds(e.target.checked ? [...serviceIds, s.id] : serviceIds.filter((x) => x !== s.id))} />
              <span className="flex-1">{s.nome}</span>
              <span className="text-ink-500 text-xs">{s.duracao_min}min</span>
            </label>
          ))}
        </div>
      </div>
      <button className="btn-primary w-full">Criar agendamento ({totalDuration}min)</button>
    </form>
  );
}
