import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { 
  Plus, Scissors, Package, Pencil, Trash2, Power, 
  AlertTriangle, Camera, X, MoreVertical, Receipt, Calculator, Settings2, ShieldCheck, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '../lib/utils';
import type { Service, Product } from '../types/db';

const LIMITS: Record<string, number> = { silver: 10, gold: 20, platinum: 999, trial: 999 };

type Tab = 'servicos' | 'produtos';

export default function Catalog() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('servicos');
  const [modal, setModal] = useState<{ type: 'service' | 'product'; data: any | 'new' } | null>(null);
  const [loading, setLoading] = useState(false);

  // Queries
  const { data: services, isLoading: loadingServices } = useQuery({
    queryKey: ['services', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*').eq('barbershop_id', barbershop!.id).order('ordem');
      return (data ?? []) as Service[];
    },
  });

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('barbershop_id', barbershop!.id).order('nome');
      return (data ?? []) as Product[];
    },
  });

  const plan = barbershop?.plan || 'silver';
  const usedServices = services?.length ?? 0;
  const usedProducts = products?.length ?? 0;
  const limit = LIMITS[plan];

  const handleSaveService = async (form: any) => {
    if (!barbershop) return;
    setLoading(true);
    const payload = { ...form, barbershop_id: barbershop.id };
    const isNew = modal?.data === 'new';
    
    const { error } = isNew
      ? await supabase.from('services').insert(payload)
      : await supabase.from('services').update(payload).eq('id', modal?.data.id);
    
    setLoading(false);
    if (error) return toast.error(error.message);
    
    toast.success(isNew ? 'Serviço criado' : 'Serviço atualizado');
    qc.invalidateQueries({ queryKey: ['services'] });
    setModal(null);
  };

  const handleSaveProduct = async (form: any) => {
    if (!barbershop) return;
    setLoading(true);
    // Sync total stock
    const totalEstoque = (form.estoque_geral || 0) + (form.estoque_fiscal || 0);
    const payload = { ...form, barbershop_id: barbershop.id, estoque: totalEstoque };
    const isNew = modal?.data === 'new';

    const { error } = isNew
      ? await supabase.from('products').insert(payload)
      : await supabase.from('products').update(payload).eq('id', modal?.data.id);

    setLoading(false);
    if (error) return toast.error(error.message);

    toast.success(isNew ? 'Produto criado' : 'Produto atualizado');
    qc.invalidateQueries({ queryKey: ['products'] });
    setModal(null);
  };

  const handleDelete = async (type: 'service' | 'product', id: string) => {
    if (!confirm('Tem certeza que deseja excluir? Esta ação não pode ser desfeita.')) return;
    
    setLoading(true);
    const { error } = await supabase.from(type === 'service' ? 'services' : 'products').delete().eq('id', id);
    setLoading(false);
    
    if (error) return toast.error(error.message);
    toast.success('Excluído com sucesso');
    qc.invalidateQueries({ queryKey: [type === 'service' ? 'services' : 'products'] });
  };

  const handleToggleActive = async (type: 'service' | 'product', id: string, currentStatus: boolean) => {
    setLoading(true);
    const { error } = await supabase.from(type === 'service' ? 'services' : 'products')
      .update({ ativo: !currentStatus }).eq('id', id);
    setLoading(false);

    if (error) return toast.error(error.message);
    toast.success(currentStatus ? 'Desativado' : 'Ativado');
    qc.invalidateQueries({ queryKey: [type === 'service' ? 'services' : 'products'] });
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <PageHeader title="Catálogo" subtitle="Gestão de serviços e produtos" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        <button onClick={() => setTab('servicos')}
          className={`px-6 py-3 text-sm font-medium -mb-px border-b-2 transition-colors ${tab === 'servicos' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>
          Serviços
        </button>
        <button onClick={() => setTab('produtos')}
          className={`px-6 py-3 text-sm font-medium -mb-px border-b-2 transition-colors ${tab === 'produtos' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>
          Produtos
        </button>
      </div>

      {/* Actions & Info Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="text-xs text-ink-500">
          Uso do plano: <span className="font-bold text-ink-300">
            {tab === 'servicos' ? `${usedServices} de ${limit}` : `${usedProducts} de ${limit}`}
          </span>
        </div>
        <button 
          className="btn-primary" 
          disabled={tab === 'servicos' ? usedServices >= limit : usedProducts >= limit}
          onClick={() => setModal({ type: tab === 'servicos' ? 'service' : 'product', data: 'new' })}
        >
          <Plus size={16} /> Novo {tab === 'servicos' ? 'Serviço' : 'Produto'}
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {tab === 'servicos' ? (
          <div className="card divide-y divide-ink-800">
            {loadingServices && <div className="p-8 text-center animate-pulse text-ink-500 text-sm">Carregando serviços...</div>}
            {!loadingServices && usedServices === 0 && (
              <div className="p-12 text-center">
                <Scissors size={32} className="mx-auto text-ink-700 mb-3" />
                <p className="text-sm text-ink-500">Nenhum serviço cadastrado</p>
              </div>
            )}
            {(services ?? []).map((s) => (
              <ItemRow 
                key={s.id} 
                title={s.nome} 
                subtitle={`${s.duracao_min} min`} 
                value={formatBRL(Number(s.valor))}
                active={s.ativo}
                onEdit={() => setModal({ type: 'service', data: s })}
                onToggle={() => handleToggleActive('service', s.id, s.ativo)}
                onDelete={() => handleDelete('service', s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingProducts && [1,2,3].map(i => <div key={i} className="card h-40 animate-pulse" />)}
            {!loadingProducts && usedProducts === 0 && (
              <div className="col-span-full card p-12 text-center">
                <Package size={32} className="mx-auto text-ink-700 mb-3" />
                <p className="text-sm text-ink-500">Nenhum produto cadastrado</p>
              </div>
            )}
            {(products ?? []).map((p) => (
              <div key={p.id} className={`card p-4 hover:border-ink-700 transition-colors group relative ${!p.ativo ? 'opacity-60 grayscale' : ''}`}>
                <div className="flex gap-4 mb-4">
                  <div className="w-14 h-14 rounded-lg bg-ink-900 border border-border shrink-0 overflow-hidden flex items-center justify-center">
                    {p.foto_url ? <img src={p.foto_url} className="w-full h-full object-cover" /> : <Package size={20} className="text-ink-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ink-50 truncate">{p.nome}</span>
                      {(p.estoque_geral + p.estoque_fiscal) <= p.estoque_min && <AlertTriangle size={14} className="text-amber-500" />}
                    </div>
                    <div className="text-[10px] text-ink-500 mt-0.5 truncate">{p.sku || 'Sem SKU'} · {formatBRL(Number(p.preco))}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-ink-950/50 rounded p-1.5 border border-ink-800/50 text-center">
                    <p className="text-[8px] font-black text-ink-500 uppercase tracking-tighter">Geral</p>
                    <p className="text-sm font-bold text-ink-100">{p.estoque_geral}</p>
                  </div>
                  <div className="bg-emerald-500/5 rounded p-1.5 border border-emerald-500/10 text-center">
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Fiscal</p>
                    <p className="text-sm font-bold text-emerald-50">{p.estoque_fiscal}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setModal({ type: 'product', data: p })} className="btn-secondary flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest">
                    <Pencil size={12} className="mr-1" /> Editar
                  </button>
                  <button onClick={() => handleToggleActive('product', p.id, p.ativo)} className="btn-ghost p-1.5" title={p.ativo ? 'Desativar' : 'Ativar'}>
                    <Power size={14} className={p.ativo ? 'text-emerald-500' : 'text-red-500'} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal 
        open={!!modal} 
        onClose={() => setModal(null)} 
        title={modal?.data === 'new' ? `Novo ${modal.type === 'service' ? 'serviço' : 'produto'}` : `Editar ${modal?.type === 'service' ? 'serviço' : 'produto'}`}
      >
        {modal?.type === 'service' && (
          <ServiceForm 
            initial={modal.data === 'new' ? null : modal.data} 
            onSave={handleSaveService} 
            loading={loading}
          />
        )}
        {modal?.type === 'product' && (
          <ProductForm 
            initial={modal.data === 'new' ? null : modal.data} 
            onSave={handleSaveProduct} 
            loading={loading}
          />
        )}
      </Modal>
    </div>
  );
}

function ItemRow({ title, subtitle, value, active, imageUrl, isLowStock, onEdit, onToggle, onDelete }: any) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={`flex items-center gap-3 p-4 transition-colors relative ${!active ? 'opacity-50' : ''}`}>
      {imageUrl !== undefined && (
        <div className="w-12 h-12 rounded-lg bg-ink-900 border border-border shrink-0 overflow-hidden flex items-center justify-center">
          {imageUrl ? <img src={imageUrl} alt={title} className="w-full h-full object-cover" /> : <Package size={20} className="text-ink-600" />}
        </div>
      )}
      <div className="flex-1 min-w-0" onClick={onEdit}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-ink-50 truncate">{title}</span>
          {isLowStock && <AlertTriangle size={12} className="text-amber-500" />}
        </div>
        <div className="text-xs text-ink-500 truncate">{subtitle}</div>
      </div>
      <div className="text-right shrink-0 mr-2" onClick={onEdit}>
        <div className="text-sm font-bold text-ink-50">{value}</div>
        {!active && <div className="text-[10px] text-red-500 uppercase font-bold tracking-tighter">Inativo</div>}
      </div>
      
      <div className="relative">
        <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-ink-500 hover:text-ink-50 transition-colors">
          <MoreVertical size={18} />
        </button>
        
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-40 bg-ink-900 border border-border rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-1">
              <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-100 hover:bg-ink-800 transition-colors">
                <Pencil size={14} /> Editar
              </button>
              <button onClick={() => { onToggle(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-100 hover:bg-ink-800 transition-colors">
                <Power size={14} /> {active ? 'Desativar' : 'Ativar'}
              </button>
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors">
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ServiceForm({ initial, onSave, loading }: { initial: Service | null; onSave: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    nome: initial?.nome ?? '',
    duracao_min: initial?.duracao_min ?? 30,
    valor: Number(initial?.valor ?? 0),
    ativo: initial?.ativo ?? true,
    lc116_code: initial?.lc116_code ?? '04.01',
    codigo_tributacao_municipio: initial?.codigo_tributacao_municipio ?? '',
    iss_aliquota: Number(initial?.iss_aliquota ?? 0)
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.duracao_min < 5 || form.duracao_min % 5 !== 0) return toast.error('Duração deve ser múltiplo de 5');
    onSave(form);
  };

  return (
    <form onSubmit={submit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div><label className="label">Nome</label><input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus disabled={loading} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Duração (min)</label><input className="input" type="number" step={5} min={5} value={form.duracao_min} onChange={(e) => setForm({ ...form, duracao_min: +e.target.value })} required disabled={loading} /></div>
        <div><label className="label">Valor (R$)</label><input className="input" type="number" step="0.01" min={0} value={form.valor} onChange={(e) => setForm({ ...form, valor: +e.target.value })} required disabled={loading} /></div>
      </div>
      
      <div className="pt-4 border-t border-ink-800 space-y-4">
        <h4 className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Informações Fiscais</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label text-[10px]">Cód. LC116</label><input className="input" value={form.lc116_code} onChange={e => setForm({ ...form, lc116_code: e.target.value })} /></div>
          <div><label className="label text-[10px]">ISS (%)</label><input className="input" type="number" step="0.01" value={form.iss_aliquota} onChange={e => setForm({ ...form, iss_aliquota: +e.target.value })} /></div>
        </div>
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-4" disabled={loading}>
        {loading ? <div className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" /> : 'Salvar Serviço'}
      </button>
    </form>
  );
}

function ProductForm({ initial, onSave, loading }: { initial: Product | null; onSave: (v: any) => void; loading: boolean }) {
  const { barbershop } = useAuth();
  const [subTab, setSubTab] = useState<'geral' | 'estoque' | 'fiscal'>(initial ? 'geral' : 'geral');
  const [form, setForm] = useState({
    nome: initial?.nome ?? '',
    sku: initial?.sku ?? '',
    custo: Number(initial?.custo ?? 0),
    preco: Number(initial?.preco ?? 0),
    estoque_min: initial?.estoque_min ?? 5,
    comissao_percentual: Number(initial?.comissao_percentual ?? 0),
    ativo: initial?.ativo ?? true,
    foto_url: initial?.foto_url ?? '',
    ncm: initial?.ncm ?? '',
    cest: initial?.cest ?? '',
    origem: initial?.origem ?? 0,
    cfop: initial?.cfop ?? '5102',
    csosn: initial?.csosn ?? '102',
    icms_aliquota: Number(initial?.icms_aliquota ?? 0),
    pis_aliquota: Number(initial?.pis_aliquota ?? 0),
    cofins_aliquota: Number(initial?.cofins_aliquota ?? 0),
    estoque_geral: initial?.estoque_geral ?? 0,
    estoque_fiscal: initial?.estoque_fiscal ?? 0,
  });
  
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    if (!barbershop || !initial?.id) return toast.error('Salve o produto antes de enviar foto');
    const ext = file.name.split('.').pop();
    const path = `${barbershop.id}/${initial.id}.${ext}`;
    setUploading(true);
    const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true });
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data } = supabase.storage.from('products').getPublicUrl(path);
    setForm(p => ({ ...p, foto_url: data.publicUrl }));
    setUploading(false);
    toast.success('Foto carregada');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-5 max-h-[80vh] overflow-y-auto px-1">
      {/* Sub-tabs logic only for Edit */}
      {initial && (
        <div className="flex gap-2 border-b border-ink-800 pb-px mb-4 overflow-x-auto">
          {[
            { id: 'geral', label: 'Básico', icon: Settings2 },
            { id: 'estoque', label: 'Estoque', icon: Calculator },
            { id: 'fiscal', label: 'Fiscal', icon: ShieldCheck }
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setSubTab(t.id as any)}
              className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${subTab === t.id ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>
              <t.icon size={12} /> {t.label}
            </button>
          ))}
        </div>
      )}

      {(subTab === 'geral' || !initial) && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {initial && (
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg bg-ink-900 border border-border overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => inputRef.current?.click()}>
                {form.foto_url ? <img src={form.foto_url} className="w-full h-full object-cover" /> : <Camera size={20} className="text-ink-700" />}
              </div>
              <div className="text-[10px] text-ink-500">
                <button type="button" onClick={() => inputRef.current?.click()} className="text-ink-200 font-bold block">Alterar Foto</button>
                <button type="button" onClick={() => setForm(p => ({ ...p, foto_url: '' }))} className="text-red-500 mt-1">Remover</button>
              </div>
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
            </div>
          )}

          <div><label className="label text-[10px]">Nome do Produto</label><input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required disabled={loading} /></div>
          
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label text-[10px]">Preço de Venda</label><input className="input font-bold text-emerald-50" type="number" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: +e.target.value })} required disabled={loading} /></div>
            <div><label className="label text-[10px]">Custo</label><input className="input" type="number" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: +e.target.value })} disabled={loading} /></div>
          </div>

          {!initial && (
            <div className="pt-4 border-t border-ink-800 space-y-4">
              <h4 className="text-[10px] font-black uppercase text-ink-500 tracking-widest">Estoque de Abertura</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label text-[10px]">Saldo GERAL</label><input className="input" type="number" value={form.estoque_geral} onChange={e => setForm({ ...form, estoque_geral: +e.target.value })} /></div>
                <div><label className="label text-[10px]">Saldo PADRÃO (Fiscal)</label><input className="input" type="number" value={form.estoque_fiscal} onChange={e => setForm({ ...form, estoque_fiscal: +e.target.value })} /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'estoque' && initial && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 space-y-3 bg-ink-900/30">
              <h4 className="text-[9px] font-black uppercase text-ink-500 tracking-tighter">Estoque GERAL</h4>
              <div className="flex items-center gap-3">
                <button type="button" className="btn-ghost p-1" onClick={() => setForm(f => ({ ...f, estoque_geral: Math.max(0, f.estoque_geral - 1) }))}><X size={14} /></button>
                <input className="bg-transparent border-none p-0 focus:ring-0 text-2xl font-bold text-center w-full" type="number" value={form.estoque_geral} onChange={e => setForm({ ...form, estoque_geral: +e.target.value })} />
                <button type="button" className="btn-ghost p-1" onClick={() => setForm(f => ({ ...f, estoque_geral: f.estoque_geral + 1 }))}><Plus size={14} /></button>
              </div>
            </div>
            <div className="card p-4 space-y-3 bg-emerald-500/5 border-emerald-500/10">
              <h4 className="text-[9px] font-black uppercase text-emerald-500 tracking-tighter">Estoque PADRÃO</h4>
              <div className="flex items-center gap-3">
                <button type="button" className="btn-ghost p-1" onClick={() => setForm(f => ({ ...f, estoque_fiscal: Math.max(0, f.estoque_fiscal - 1) }))}><X size={14} /></button>
                <input className="bg-transparent border-none p-0 focus:ring-0 text-2xl font-bold text-center w-full text-emerald-50" type="number" value={form.estoque_fiscal} onChange={e => setForm({ ...form, estoque_fiscal: +e.target.value })} />
                <button type="button" className="btn-ghost p-1" onClick={() => setForm(f => ({ ...f, estoque_fiscal: f.estoque_fiscal + 1 }))}><Plus size={14} /></button>
              </div>
            </div>
          </div>
          <div><label className="label text-[10px]">Estoque Mínimo (Alerta)</label><input className="input" type="number" value={form.estoque_min} onChange={e => setForm({ ...form, estoque_min: +e.target.value })} /></div>
        </div>
      )}

      {(subTab === 'fiscal' || !initial) && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="pt-4 border-t border-ink-800">
            <h4 className="text-[10px] font-black uppercase text-ink-500 tracking-widest mb-3">Informações Fiscais</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label text-[10px]">NCM</label><input className="input" value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} placeholder="8 dígitos" /></div>
              <div><label className="label text-[10px]">CEST</label><input className="input" value={form.cest} onChange={e => setForm({ ...form, cest: e.target.value })} placeholder="7 dígitos" /></div>
              <div><label className="label text-[10px]">CFOP Padrão</label><input className="input" value={form.cfop} onChange={e => setForm({ ...form, cfop: e.target.value })} /></div>
              <div><label className="label text-[10px]">CSOSN / CST</label><input className="input" value={form.csosn} onChange={e => setForm({ ...form, csosn: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div><label className="label text-[10px]">ICMS (%)</label><input className="input" type="number" step="0.01" value={form.icms_aliquota} onChange={e => setForm({ ...form, icms_aliquota: +e.target.value })} /></div>
              <div><label className="label text-[10px]">PIS (%)</label><input className="input" type="number" step="0.01" value={form.pis_aliquota} onChange={e => setForm({ ...form, pis_aliquota: +e.target.value })} /></div>
              <div><label className="label text-[10px]">COFINS (%)</label><input className="input" type="number" step="0.01" value={form.cofins_aliquota} onChange={e => setForm({ ...form, cofins_aliquota: +e.target.value })} /></div>
            </div>
          </div>
        </div>
      )}

      <button className="btn-primary w-full flex items-center justify-center gap-2 py-3 mt-4 text-[11px] font-black uppercase tracking-widest" disabled={loading || uploading}>
        {loading ? <div className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" /> : initial ? 'Salvar Alterações' : 'Cadastrar Produto'}
      </button>
    </form>
  );
}
