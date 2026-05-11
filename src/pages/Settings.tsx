import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Barber } from '../types/db';

export default function Settings() {
  const { barbershop, refresh } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'geral' | 'equipe'>('geral');
  const [nome, setNome] = useState(barbershop?.nome ?? '');
  const [telefone, setTelefone] = useState(barbershop?.telefone ?? '');
  const [endereco, setEndereco] = useState(barbershop?.endereco ?? '');
  const [slug, setSlug] = useState(barbershop?.slug ?? '');
  const [cancel, setCancel] = useState(barbershop?.cancel_min_hours ?? 2);

  const saveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbershop) return;
    const { error } = await supabase.from('barbershops').update({ nome, telefone, endereco, slug, cancel_min_hours: cancel }).eq('id', barbershop.id);
    if (error) return toast.error(error.message);
    toast.success('Salvo');
    refresh();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader title="Configurações" />
      <div className="flex gap-1 border-b border-ink-800 mb-6">
        <button onClick={() => setTab('geral')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === 'geral' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Geral</button>
        <button onClick={() => setTab('equipe')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === 'equipe' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Equipe</button>
      </div>
      {tab === 'geral' && (
        <form onSubmit={saveShop} className="card p-6 space-y-4 max-w-xl">
          <div><label className="label">Nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><label className="label">Slug</label><input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div><label className="label">Telefone</label><input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
          <div><label className="label">Endereço</label><input className="input" value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
          <div><label className="label">Antecedência mín. cancelamento (horas)</label><input className="input" type="number" value={cancel} onChange={(e) => setCancel(+e.target.value)} /></div>
          <button className="btn-primary">Salvar</button>
        </form>
      )}
      {tab === 'equipe' && <BarbersTab qc={qc} />}
    </div>
  );
}

function BarbersTab({ qc }: any) {
  const { barbershop } = useAuth();
  const [modal, setModal] = useState<Barber | 'new' | null>(null);
  const { data: barbers } = useQuery({
    queryKey: ['barbers-settings', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('barbers').select('*').eq('barbershop_id', barbershop!.id).order('nome_exibicao');
      return (data ?? []) as Barber[];
    },
  });
  const save = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new'
      ? await supabase.from('barbers').insert(payload)
      : await supabase.from('barbers').update(payload).eq('id', (modal as Barber).id);
    if (error) return toast.error(error.message);
    toast.success('Salvo');
    qc.invalidateQueries({ queryKey: ['barbers-settings'] });
    setModal(null);
  };
  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setModal('new')}><Plus size={16} /> Adicionar barbeiro</button>
      </div>
      <div className="card divide-y divide-ink-800">
        {(barbers ?? []).map((b) => (
          <button key={b.id} onClick={() => setModal(b)} className="w-full text-left p-4 hover:bg-ink-800/40 flex justify-between">
            <div>
              <div className="text-ink-50">{b.nome_exibicao}</div>
              <div className="text-xs text-ink-500">Comissão {b.comissao_padrao}% · {b.ativo ? 'ativo' : 'inativo'}</div>
            </div>
          </button>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Novo barbeiro' : 'Editar barbeiro'}>
        <BarberForm initial={modal === 'new' ? null : modal} onSave={save} />
      </Modal>
    </div>
  );
}

function BarberForm({ initial, onSave }: { initial: Barber | null; onSave: (v: any) => void }) {
  const [form, setForm] = useState({
    nome_exibicao: initial?.nome_exibicao ?? '',
    comissao_padrao: Number(initial?.comissao_padrao ?? 50),
    ativo: initial?.ativo ?? true,
    cor_agenda: initial?.cor_agenda ?? '#6b7280',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div><label className="label">Nome</label><input className="input" value={form.nome_exibicao} onChange={(e) => setForm({ ...form, nome_exibicao: e.target.value })} required autoFocus /></div>
      <div><label className="label">Comissão padrão (%)</label><input className="input" type="number" step="0.01" value={form.comissao_padrao} onChange={(e) => setForm({ ...form, comissao_padrao: +e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm text-ink-300"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
      <button className="btn-primary w-full">Salvar</button>
    </form>
  );
}
