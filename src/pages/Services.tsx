import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Plus, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '../lib/utils';
import type { Service } from '../types/db';

const SERVICE_LIMITS: Record<string, number> = { silver: 10, gold: 20, platinum: 999, trial: 999 };

export default function Services() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<Service | 'new' | null>(null);

  const { data: services } = useQuery({
    queryKey: ['services', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('barbershop_id', barbershop!.id).order('ordem');
      return (data ?? []) as Service[];
    },
  });

  const canAddService = (services?.length ?? 0) < SERVICE_LIMITS[barbershop?.plan || 'silver'];

  const save = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new'
      ? await supabase.from('services').insert(payload)
      : await supabase.from('services').update(payload).eq('id', (modal as Service).id);
    if (error) return toast.error(error.message);
    toast.success('Serviço salvo');
    qc.invalidateQueries({ queryKey: ['services'] });
    setModal(null);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader title="Serviços"
        actions={
          <div className="flex items-center gap-4">
            <span className="text-[10px] uppercase font-bold text-ink-500 tracking-widest">
              {services?.length ?? 0} / {SERVICE_LIMITS[barbershop?.plan || 'silver']} usados
            </span>
            <button 
              className="btn-primary" 
              disabled={!canAddService}
              onClick={() => {
                if (!canAddService) return toast.error('Limite de serviços atingido para seu plano.');
                setModal('new');
              }}
            >
              <Plus size={16} /> Novo serviço
            </button>
          </div>
        } 
      />
      <div className="card divide-y divide-ink-800">
        {(!services || services.length === 0) && (
          <div className="p-12 text-center">
            <Scissors size={32} className="mx-auto text-ink-600 mb-3" />
            <p className="text-sm text-ink-400">Nenhum serviço cadastrado</p>
          </div>
        )}
        {(services ?? []).map((s) => (
          <button key={s.id} onClick={() => setModal(s)} className="w-full text-left p-4 hover:bg-ink-800/40 flex items-center justify-between">
            <div>
              <div className="text-ink-50 font-medium">{s.nome}</div>
              <div className="text-xs text-ink-500">{s.duracao_min} min {!s.ativo && '· inativo'}</div>
            </div>
            <div className="text-ink-100 font-medium">{formatBRL(Number(s.valor))}</div>
          </button>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Novo serviço' : 'Editar serviço'}>
        <ServiceForm initial={modal === 'new' ? null : modal} onSave={save} />
      </Modal>
    </div>
  );
}

function ServiceForm({ initial, onSave }: { initial: Service | null; onSave: (v: any) => void }) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [duracao, setDuracao] = useState(initial?.duracao_min ?? 30);
  const [valor, setValor] = useState(Number(initial?.valor ?? 0));
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (duracao < 15 || duracao % 5 !== 0) return toast.error('Duração: mínimo 15 min, múltiplo de 5');
    onSave({ nome, duracao_min: duracao, valor, ativo });
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Duração (min)</label><input className="input" type="number" step={5} min={15} value={duracao} onChange={(e) => setDuracao(+e.target.value)} required /></div>
        <div><label className="label">Valor (R$)</label><input className="input" type="number" step="0.01" min={0} value={valor} onChange={(e) => setValor(+e.target.value)} required /></div>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-300"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo</label>
      <button className="btn-primary w-full">Salvar</button>
    </form>
  );
}
