import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { 
  Plus, Scissors, Package, Pencil, Trash2, Power, 
  AlertTriangle, Camera, X, MoreVertical 
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
  const [stockModal, setStockModal] = useState<Product | null>(null);
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
    const payload = { ...form, barbershop_id: barbershop.id };
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

  const handleAddStock = async (product: Product, qtd: number, motivo: string) => {
    setLoading(true);
    const { error } = await supabase.from('stock_movements').insert({ product_id: product.id, tipo: 'entrada', qtd, motivo });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    await supabase.from('products').update({ estoque: product.estoque + qtd }).eq('id', product.id);
    setLoading(false);
    toast.success('Estoque atualizado');
    qc.invalidateQueries({ queryKey: ['products'] });
    setStockModal(null);
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
          <div className="card divide-y divide-ink-800">
            {loadingProducts && <div className="p-8 text-center animate-pulse text-ink-500 text-sm">Carregando produtos...</div>}
            {!loadingProducts && usedProducts === 0 && (
              <div className="p-12 text-center">
                <Package size={32} className="mx-auto text-ink-700 mb-3" />
                <p className="text-sm text-ink-500">Nenhum produto cadastrado</p>
              </div>
            )}
            {(products ?? []).map((p) => (
              <ItemRow 
                key={p.id} 
                title={p.nome} 
                subtitle={p.sku ? `SKU: ${p.sku} · Est: ${p.estoque}` : `Estoque: ${p.estoque}`}
                value={formatBRL(Number(p.preco))}
                active={p.ativo}
                imageUrl={p.foto_url}
                isLowStock={p.estoque <= p.estoque_min}
                onEdit={() => setModal({ type: 'product', data: p })}
                onToggle={() => handleToggleActive('product', p.id, p.ativo)}
                onDelete={() => handleDelete('product', p.id)}
                onStock={() => setStockModal(p)}
              />
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

      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={`Entrada de estoque — ${stockModal?.nome ?? ''}`}>
        {stockModal && <StockForm onSave={(qtd, motivo) => handleAddStock(stockModal, qtd, motivo)} loading={loading} />}
      </Modal>
    </div>
  );
}

function ItemRow({ title, subtitle, value, active, imageUrl, isLowStock, onEdit, onToggle, onDelete, onStock }: any) {
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
              {onStock && (
                <button onClick={() => { onStock(); setShowMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ink-100 hover:bg-ink-800 transition-colors">
                  <Plus size={14} /> + Estoque
                </button>
              )}
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
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.duracao_min < 5 || form.duracao_min % 5 !== 0) return toast.error('Duração deve ser múltiplo de 5');
    onSave(form);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div><label className="label">Nome</label><input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required autoFocus disabled={loading} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Duração (min)</label><input className="input" type="number" step={5} min={5} value={form.duracao_min} onChange={(e) => setForm({ ...form, duracao_min: +e.target.value })} required disabled={loading} /></div>
        <div><label className="label">Valor (R$)</label><input className="input" type="number" step="0.01" min={0} value={form.valor} onChange={(e) => setForm({ ...form, valor: +e.target.value })} required disabled={loading} /></div>
      </div>
      <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
        {loading ? <div className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" /> : 'Salvar'}
      </button>
    </form>
  );
}

function ProductForm({ initial, onSave, loading }: { initial: Product | null; onSave: (v: any) => void; loading: boolean }) {
  const { barbershop } = useAuth();
  const [form, setForm] = useState({
    nome: initial?.nome ?? '', sku: initial?.sku ?? '',
    custo: Number(initial?.custo ?? 0), preco: Number(initial?.preco ?? 0),
    estoque: initial?.estoque ?? 0, estoque_min: initial?.estoque_min ?? 0,
    comissao_percentual: Number(initial?.comissao_percentual ?? 0),
    ativo: initial?.ativo ?? true, foto_url: initial?.foto_url ?? '',
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
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      {initial && (
        <div className="flex items-center gap-4 mb-2">
          <div className="w-20 h-20 rounded-lg bg-ink-900 border border-border overflow-hidden flex items-center justify-center cursor-pointer hover:bg-ink-800 transition-colors"
               onClick={() => inputRef.current?.click()}>
            {form.foto_url ? <img src={form.foto_url} alt="product" className="w-full h-full object-cover" /> : <Camera size={24} className="text-ink-600" />}
            {uploading && <div className="absolute inset-0 bg-ink-950/50 flex items-center justify-center"><div className="w-5 h-5 border-2 border-ink-50/30 border-t-ink-50 rounded-full animate-spin" /></div>}
          </div>
          <div className="text-xs text-ink-500">
            <p>Clique ao lado para alterar a foto.</p>
            <button type="button" onClick={() => setForm(p => ({ ...p, foto_url: '' }))} className="text-red-500 mt-1">Remover foto</button>
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
        </div>
      )}

      <div><label className="label">Nome</label><input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required disabled={loading} /></div>
      <div><label className="label">SKU</label><input className="input" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} disabled={loading} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Custo</label><input className="input" type="number" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: +e.target.value })} disabled={loading} /></div>
        <div><label className="label">Preço de Venda</label><input className="input" type="number" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: +e.target.value })} disabled={loading} /></div>
        {!initial && (
          <div><label className="label">Estoque Inicial</label><input className="input" type="number" value={form.estoque} onChange={e => setForm({ ...form, estoque: +e.target.value })} disabled={loading} /></div>
        )}
        <div><label className="label">Estoque Mín.</label><input className="input" type="number" value={form.estoque_min} onChange={e => setForm({ ...form, estoque_min: +e.target.value })} disabled={loading} /></div>
        <div className={initial ? 'col-span-2' : ''}><label className="label">Comissão em Venda (%)</label><input className="input" type="number" step="0.01" value={form.comissao_percentual} onChange={e => setForm({ ...form, comissao_percentual: +e.target.value })} disabled={loading} /></div>
      </div>
      <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading || uploading}>
        {loading ? <div className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" /> : 'Salvar Produto'}
      </button>
    </form>
  );
}

function StockForm({ onSave, loading }: { onSave: (qtd: number, motivo: string) => void, loading: boolean }) {
  const [qtd, setQtd] = useState(1);
  const [motivo, setMotivo] = useState('Compra');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(qtd, motivo); }} className="space-y-4">
      <div><label className="label">Quantidade</label>
        <input className="input" type="number" min={1} value={qtd} onChange={e => setQtd(+e.target.value)} disabled={loading} /></div>
      <div><label className="label">Motivo</label>
        <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} disabled={loading} /></div>
      <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
        {loading ? <div className="w-4 h-4 border-2 border-ink-950/30 border-t-ink-950 rounded-full animate-spin" /> : 'Registrar Entrada'}
      </button>
    </form>
  );
}
