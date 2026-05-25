import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  addDays, addMinutes, format, isBefore, parseISO, startOfDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  CheckCircle2, ChevronLeft, Clock, MapPin, Phone, Scissors,
} from 'lucide-react';
import { formatBRL, isValidPhone, maskPhone } from '../lib/utils';
import type { Barber, Service } from '../types/db';

const START_HOUR = 8;
const END_HOUR = 20;

function generateSlots(date: Date): Date[] {
  const slots: Date[] = [];
  let t = new Date(date);
  t.setHours(START_HOUR, 0, 0, 0);
  const end = new Date(date);
  end.setHours(END_HOUR, 0, 0, 0);
  while (isBefore(t, end)) {
    slots.push(new Date(t));
    t = addMinutes(t, 30);
  }
  return slots;
}

function slotConflicts(
  slot: Date,
  duration: number,
  appts: Array<{ data_hora: string; duracao_min: number }>,
): boolean {
  const slotEnd = addMinutes(slot, duration);
  return appts.some((a) => {
    const aStart = parseISO(a.data_hora);
    const aEnd = addMinutes(aStart, a.duracao_min);
    return slot < aEnd && slotEnd > aStart;
  });
}

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [service, setService] = useState<Service | null>(null);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [slot, setSlot] = useState<Date | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { data: shop, isLoading, error } = useQuery({
    queryKey: ['public-shop', slug],
    enabled: !!slug,
    queryFn: async () => {
      const cleanSlug = slug?.trim().toLowerCase();
      if (!cleanSlug) throw new Error('Slug inválido');

      const { data, error } = await supabase
        .from('barbershops')
        .select('id,nome,slug,telefone,endereco')
        .eq('slug', cleanSlug)
        .single();
      
      if (error) {
        console.error('Error fetching shop:', error);
        throw error;
      }
      return data as { id: string; nome: string; slug: string; telefone: string; endereco: string };
    },
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['public-services', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('services')
        .select('id,barbershop_id,nome,duracao_min,valor,ativo,ordem')
        .eq('barbershop_id', shop!.id)
        .eq('ativo', true)
        .order('ordem');
      return (data ?? []) as Service[];
    },
  });

  const { data: barbers = [] } = useQuery<Barber[]>({
    queryKey: ['public-barbers', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('barbers')
        .select('id,barbershop_id,member_id,nome_exibicao,comissao_padrao,ativo,cor_agenda,barber_login,barber_pin')
        .eq('barbershop_id', shop!.id)
        .eq('ativo', true)
        .order('nome_exibicao');
      return (data ?? []) as Barber[];
    },
  });

  const { data: appts = [] } = useQuery({
    queryKey: ['public-appts', barber?.id, date.toDateString()],
    enabled: !!barber && step === 2,
    queryFn: async () => {
      const start = startOfDay(date).toISOString();
      const end = startOfDay(addDays(date, 1)).toISOString();
      const { data, error } = await supabase
        .from('appointments')
        .select('data_hora,duracao_min')
        .eq('barber_id', barber!.id)
        .gte('data_hora', start)
        .lt('data_hora', end)
        .not('status', 'in', ['cancelado', 'no_show']);
      
      if (error) throw error;
      return (data ?? []) as Array<{ data_hora: string; duracao_min: number }>;
    },
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)), []);
  const slots = useMemo(() => generateSlots(date), [date]);
  const availableSlots = useMemo(() => {
    const now = new Date();
    return slots.filter((s) => {
      if (isBefore(s, now)) return false;
      return !slotConflicts(s, service?.duracao_min ?? 30, appts);
    });
  }, [slots, service, appts]);

  const handleSubmit = async () => {
    if (!service || !barber || !slot) return;
    if (!nome.trim()) return toast.error('Informe seu nome.');
    if (!isValidPhone(telefone)) return toast.error('Telefone inválido. Use (DD) 9 XXXX-XXXX.');

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('create_public_booking', {
        p_barbershop_slug: slug,
        p_service_id: service.id,
        p_barber_id: barber.id,
        p_data_hora: slot.toISOString(),
        p_client_nome: nome.trim(),
        p_client_telefone: telefone.replace(/\D/g, ''),
      });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="logo text-3xl text-ink-500 animate-pulse">Navalha</div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <Scissors size={40} className="text-ink-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-ink-50 mb-2">Página indisponível</h1>
          <p className="text-ink-400 text-sm mb-6">
            Não conseguimos localizar esta barbearia. O link pode estar incorreto ou a página foi removida.
          </p>
          <a href="/" className="btn-outline w-full">Voltar para o início</a>
          {error && (
            <div className="mt-8 pt-4 border-t border-ink-900">
              <p className="text-[10px] text-ink-600 font-mono break-all uppercase tracking-tighter">
                Detalhes técnicos: {error instanceof Error ? error.message : JSON.stringify(error)}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <CheckCircle2 size={56} className="text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-ink-50 mb-2">Agendamento confirmado!</h1>
          <p className="text-ink-400 text-sm mb-1">
            <span className="font-semibold text-ink-200">{service?.nome}</span> com{' '}
            <span className="font-semibold text-ink-200">{barber?.nome_exibicao}</span>
          </p>
          <p className="text-ink-400 text-sm mb-6">
            {slot && format(slot, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
          <p className="text-xs text-ink-600">
            Em caso de cancelamento, entre em contato com a barbearia.
          </p>
          {shop.telefone && (
            <a
              href={`https://wa.me/55${shop.telefone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              <Phone size={14} /> WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 pb-16">
      {/* Header */}
      <div className="border-b border-ink-800 px-4 py-5">
        <div className="max-w-lg mx-auto">
          <div className="logo text-xl text-ink-100 mb-1">Navalha</div>
          <h1 className="text-2xl font-bold text-ink-50">{shop.nome}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-ink-500">
            {shop.endereco && (
              <span className="flex items-center gap-1"><MapPin size={12} />{shop.endereco}</span>
            )}
            {shop.telefone && (
              <a
                href={`https://wa.me/55${shop.telefone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
              >
                <Phone size={12} />
                {shop.telefone}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {(['Serviço', 'Horário', 'Dados'] as const).map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step > i + 1 ? 'bg-emerald-500 text-white' :
                step === i + 1 ? 'bg-ink-50 text-ink-950' : 'bg-ink-800 text-ink-500'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${step === i + 1 ? 'text-ink-100' : 'text-ink-500'}`}>{label}</span>
              {i < 2 && <div className="w-8 h-px bg-ink-800" />}
            </div>
          ))}
        </div>

        {/* Step 1: Service + Barber */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-ink-500 uppercase tracking-widest mb-3">Escolha o serviço</h2>
              <div className="space-y-2">
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setService(s)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      service?.id === s.id
                        ? 'border-ink-50 bg-ink-800'
                        : 'border-ink-800 bg-ink-900 hover:border-ink-600'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-ink-100">{s.nome}</span>
                      <span className="font-bold text-ink-50">{formatBRL(s.valor)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-ink-500">
                      <Clock size={11} /> {s.duracao_min} min
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {service && (
              <div>
                <h2 className="text-sm font-bold text-ink-500 uppercase tracking-widest mb-3">Escolha o barbeiro</h2>
                <div className="grid grid-cols-2 gap-2">
                  {barbers.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBarber(b)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        barber?.id === b.id
                          ? 'border-ink-50 bg-ink-800'
                          : 'border-ink-800 bg-ink-900 hover:border-ink-600'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full mb-2 flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: b.cor_agenda }}
                      >
                        {b.nome_exibicao[0]}
                      </div>
                      <span className="text-sm font-medium text-ink-100">{b.nome_exibicao}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {service && barber && (
              <button
                className="btn-primary w-full"
                onClick={() => setStep(2)}
              >
                Escolher horário
              </button>
            )}
          </div>
        )}

        {/* Step 2: Date + Time */}
        {step === 2 && (
          <div className="space-y-5">
            <button
              onClick={() => { setStep(1); setSlot(null); }}
              className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-300"
            >
              <ChevronLeft size={14} /> Voltar
            </button>

            <div>
              <h2 className="text-sm font-bold text-ink-500 uppercase tracking-widest mb-3">Escolha o dia</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((d) => (
                  <button
                    key={d.toDateString()}
                    onClick={() => { setDate(d); setSlot(null); }}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border text-xs transition-all ${
                      d.toDateString() === date.toDateString()
                        ? 'border-ink-50 bg-ink-800 text-ink-50'
                        : 'border-ink-800 bg-ink-900 text-ink-400 hover:border-ink-600'
                    }`}
                  >
                    <span className="uppercase font-bold">{format(d, 'EEE', { locale: ptBR })}</span>
                    <span className="text-lg font-bold mt-0.5">{format(d, 'dd')}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold text-ink-500 uppercase tracking-widest mb-3">
                Horários disponíveis
              </h2>
              {availableSlots.length === 0 ? (
                <p className="text-sm text-ink-500 text-center py-8">
                  Sem horários disponíveis neste dia.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availableSlots.map((s) => (
                    <button
                      key={s.toISOString()}
                      onClick={() => setSlot(s)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                        slot?.toISOString() === s.toISOString()
                          ? 'border-ink-50 bg-ink-800 text-ink-50'
                          : 'border-ink-800 bg-ink-900 text-ink-400 hover:border-ink-600'
                      }`}
                    >
                      {format(s, 'HH:mm')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {slot && (
              <button className="btn-primary w-full" onClick={() => setStep(3)}>
                Continuar
              </button>
            )}
          </div>
        )}

        {/* Step 3: Client info + Confirm */}
        {step === 3 && (
          <div className="space-y-5">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-300"
            >
              <ChevronLeft size={14} /> Voltar
            </button>

            {/* Summary */}
            <div className="card p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">Serviço</span>
                <span className="font-medium text-ink-100">{service?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Barbeiro</span>
                <span className="font-medium text-ink-100">{barber?.nome_exibicao}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Data/hora</span>
                <span className="font-medium text-ink-100">
                  {slot && format(slot, "dd/MM 'às' HH:mm")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Valor</span>
                <span className="font-bold text-ink-50">{formatBRL(service?.valor ?? 0)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold text-ink-500 uppercase tracking-widest">Seus dados</h2>
              <div>
                <label className="label">Nome</label>
                <input
                  className="input"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">WhatsApp</label>
                <input
                  className="input"
                  placeholder="(85) 9 9999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  inputMode="numeric"
                />
              </div>
            </div>

            <button
              className="btn-primary w-full"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" />
                  Confirmando...
                </span>
              ) : 'Confirmar agendamento'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
