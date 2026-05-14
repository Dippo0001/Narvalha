import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { format, addDays, startOfDay, addMinutes, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Service, Barber } from '../types/db';

export default function PublicBooking() {
  const { slug } = useParams();
  const [step, setStep] = useState(1);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string>('any');
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [time, setTime] = useState<Date | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [success, setSuccess] = useState<{ appointment_id: string; data_hora: string } | null>(null);

  const { data: shop } = useQuery({
    queryKey: ['pubshop', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase.from('public_barbershops').select('*').eq('slug', slug!).maybeSingle();
      return data as any;
    },
  });

  const { data: services } = useQuery({
    queryKey: ['pubsvc', shop?.id],
    enabled: !!shop,
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('barbershop_id', shop.id).eq('ativo', true).order('ordem');
      return (data ?? []) as Service[];
    },
  });

  const { data: barbers } = useQuery({
    queryKey: ['pubbarbs', shop?.id],
    enabled: !!shop,
    queryFn: async () => {
      const { data } = await supabase.from('barbers').select('*').eq('barbershop_id', shop.id).eq('ativo', true);
      return (data ?? []) as Barber[];
    },
  });

  const totalDuration = useMemo(
    () => (services ?? []).filter(s => serviceIds.includes(s.id)).reduce((sum, s) => sum + s.duracao_min, 0) || 30,
    [services, serviceIds]
  );

  const chosenBarbers = useMemo(() => {
    if (barberId === 'any') return barbers ?? [];
    return (barbers ?? []).filter(b => b.id === barberId);
  }, [barbers, barberId]);

  const { data: busy } = useQuery({
    queryKey: ['pubbusy', shop?.id, date.toISOString()],
    enabled: !!shop,
    queryFn: async () => {
      const start = startOfDay(date).toISOString();
      const end = addDays(startOfDay(date), 1).toISOString();
      const { data } = await supabase.from('appointments').select('barber_id,data_hora,duracao_min,status')
        .eq('barbershop_id', shop.id).gte('data_hora', start).lt('data_hora', end);
      return (data ?? []).filter((a: any) => !['cancelado', 'no_show'].includes(a.status));
    },
  });

  const availableSlots = useMemo(() => {
    const slots: { time: Date; barber_id: string }[] = [];
    if (!shop) return slots;
    
    const base = startOfDay(date);
    const maxChairs = shop.num_cadeiras || 1;

    for (let h = 8; h < 21; h++) {
      for (let m = 0; m < 60; m += 15) {
        const t = addMinutes(base, h * 60 + m);
        if (t < new Date()) continue;

        const end = addMinutes(t, totalDuration);

        // 1. Verificar ocupação total das cadeiras
        const occupiedChairs = (busy ?? []).filter((a: any) => {
          const s = parseISO(a.data_hora);
          const e = addMinutes(s, a.duracao_min);
          return t < e && end > s;
        }).length;

        if (occupiedChairs >= maxChairs) continue;

        // 2. Tentar encaixar com um barbeiro disponível
        for (const b of chosenBarbers) {
          const barberBusy = (busy ?? []).some((a: any) => {
            if (a.barber_id !== b.id) return false;
            const s = parseISO(a.data_hora);
            const e = addMinutes(s, a.duracao_min);
            return t < e && end > s;
          });

          if (!barberBusy) {
            slots.push({ time: t, barber_id: b.id });
            break; 
          }
        }
      }
    }
    return slots;
  }, [busy, chosenBarbers, date, totalDuration, shop]);

  const submit = async () => {
    if (!shop || !time || !nome || !telefone) return;
    const chosenSlot = availableSlots.find(s => s.time.getTime() === time.getTime());
    if (!chosenSlot) return toast.error('Horário indisponível');
    // client upsert via phone
    const { data: existing } = await supabase.from('clients').select('id').eq('barbershop_id', shop.id).eq('telefone', telefone).maybeSingle();
    let cid = existing?.id;
    if (!cid) {
      const { data: c, error } = await supabase.from('clients').insert({ barbershop_id: shop.id, nome, telefone }).select('id').single();
      if (error) return toast.error(error.message);
      cid = c.id;
    }
    const { data: appt, error } = await supabase.from('appointments').insert({
      barbershop_id: shop.id, client_id: cid, barber_id: chosenSlot.barber_id,
      data_hora: time.toISOString(), duracao_min: totalDuration, status: 'agendado', origem: 'online',
    }).select('id').single();
    if (error) return toast.error(error.message);
    if (serviceIds.length) {
      await supabase.from('appointment_services').insert(serviceIds.map(sid => ({ appointment_id: appt.id, service_id: sid })));
    }
    setSuccess({ appointment_id: appt.id, data_hora: time.toISOString() });
  };

  if (!shop) return <div className="min-h-screen bg-ink-950 flex items-center justify-center text-ink-500">Barbearia não encontrada</div>;

  if (success) {
    const dt = new Date(success.data_hora);
    const end = addMinutes(dt, totalDuration);
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Agendamento ${shop.nome}\nDTSTART:${format(dt, "yyyyMMdd'T'HHmmss")}\nDTEND:${format(end, "yyyyMMdd'T'HHmmss")}\nEND:VEVENT\nEND:VCALENDAR`;
    const icsUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    const wa = `https://wa.me/${(shop.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Confirmo meu agendamento em ${shop.nome} no dia ${format(dt, "dd/MM 'às' HH:mm", { locale: ptBR })}`)}`;
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center p-6">
        <div className="card max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-ink-800 flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-ink-50" />
          </div>
          <h2 className="logo text-3xl text-ink-50 mb-2">Agendado!</h2>
          <p className="text-ink-400">{format(dt, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
          <p className="text-sm text-ink-500 mt-1">{shop.nome}</p>
          <div className="space-y-2 mt-6">
            <a href={icsUrl} download="agendamento.ics" className="btn-outline w-full">Adicionar ao Google Calendar</a>
            {shop.telefone && <a href={wa} target="_blank" rel="noreferrer" className="btn-primary w-full">Confirmar via WhatsApp</a>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-xs text-ink-500 uppercase tracking-wide mb-1">Agendamento online</div>
          <div className="logo text-4xl text-ink-50">{shop.nome}</div>
        </div>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className={`flex-1 h-1 rounded ${step >= n ? 'bg-ink-50' : 'bg-ink-800'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="card p-6">
            <h3 className="text-lg text-ink-50 mb-4">Escolha os serviços</h3>
            <div className="space-y-2 mb-6">
              {(services ?? []).map(s => (
                <label key={s.id} className="flex items-center gap-3 p-3 border border-ink-800 rounded hover:bg-ink-900 cursor-pointer">
                  <input type="checkbox" checked={serviceIds.includes(s.id)}
                    onChange={e => setServiceIds(e.target.checked ? [...serviceIds, s.id] : serviceIds.filter(x => x !== s.id))} />
                  <div className="flex-1">
                    <div className="text-ink-100">{s.nome}</div>
                    <div className="text-xs text-ink-500">{s.duracao_min} min · R$ {Number(s.valor).toFixed(2)}</div>
                  </div>
                </label>
              ))}
            </div>
            <button disabled={serviceIds.length === 0} onClick={() => setStep(2)} className="btn-primary w-full">Continuar</button>
          </div>
        )}

        {step === 2 && (
          <div className="card p-6">
            <h3 className="text-lg text-ink-50 mb-4">Escolha o profissional</h3>
            <div className="space-y-2 mb-6">
              <button onClick={() => setBarberId('any')}
                className={`w-full p-3 border rounded text-left ${barberId === 'any' ? 'border-ink-50 bg-ink-900' : 'border-ink-800'}`}>
                <div className="text-ink-100">Qualquer profissional</div>
                <div className="text-xs text-ink-500">Primeiro horário disponível</div>
              </button>
              {(barbers ?? []).map(b => (
                <button key={b.id} onClick={() => setBarberId(b.id)}
                  className={`w-full p-3 border rounded text-left ${barberId === b.id ? 'border-ink-50 bg-ink-900' : 'border-ink-800'}`}>
                  <div className="text-ink-100">{b.nome_exibicao}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn-outline flex-1">Voltar</button>
              <button onClick={() => setStep(3)} className="btn-primary flex-1">Continuar</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card p-6">
            <h3 className="text-lg text-ink-50 mb-4">Escolha data e horário</h3>
            <div className="flex gap-2 overflow-x-auto mb-4 pb-2">
              {Array.from({ length: 14 }).map((_, i) => {
                const d = addDays(startOfDay(new Date()), i);
                const isSel = d.getTime() === date.getTime();
                return (
                  <button key={i} onClick={() => { setDate(d); setTime(null); }}
                    className={`shrink-0 px-3 py-2 rounded border ${isSel ? 'border-ink-50 bg-ink-50 text-ink-950' : 'border-ink-800 text-ink-300'}`}>
                    <div className="text-[10px] uppercase">{format(d, 'EEE', { locale: ptBR })}</div>
                    <div className="text-sm font-medium">{format(d, 'dd/MM')}</div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-4 gap-2 mb-6 max-h-64 overflow-auto">
              {availableSlots.length === 0 && <div className="col-span-4 text-center text-ink-500 text-sm py-8">Sem horários disponíveis</div>}
              {availableSlots.map((s, i) => (
                <button key={i} onClick={() => setTime(s.time)}
                  className={`p-2 rounded border text-sm ${time?.getTime() === s.time.getTime() ? 'border-ink-50 bg-ink-50 text-ink-950' : 'border-ink-800 text-ink-200'}`}>
                  {format(s.time, 'HH:mm')}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="btn-outline flex-1">Voltar</button>
              <button disabled={!time} onClick={() => setStep(4)} className="btn-primary flex-1">Continuar</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card p-6">
            <h3 className="text-lg text-ink-50 mb-4">Seus dados</h3>
            <div className="space-y-3 mb-6">
              <div><label className="label">Nome</label><input className="input" value={nome} onChange={e => setNome(e.target.value)} autoFocus /></div>
              <div><label className="label">Telefone</label><input className="input" value={telefone} onChange={e => setTelefone(e.target.value)} /></div>
            </div>
            <div className="card bg-ink-900 p-4 mb-6 text-sm">
              <div className="text-ink-400">Resumo</div>
              <div className="text-ink-100 mt-1">{time && format(time, "EEEE, dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</div>
              <div className="text-xs text-ink-500 mt-1">
                {(services ?? []).filter(s => serviceIds.includes(s.id)).map(s => s.nome).join(', ')}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="btn-outline flex-1">Voltar</button>
              <button disabled={!nome || !telefone} onClick={submit} className="btn-primary flex-1">Confirmar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
