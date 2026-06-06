import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { 
  Plus, Search, Package, AlertTriangle, 
  History, Camera, X, Check, Receipt, Calculator, Settings2, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '../lib/utils';
import type { Product } from '../types/db';

export default function Products() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'inventory' | 'pdv' | 'history'>('inventory');
  const [modal, setModal] = useState<Product | 'new' | null>(null);
  const [editModal, setEditModal] = useState<Product | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('barbershop_id', barbershop!.id).order('nome');
      return data as Product[];
    },
  });

  const filtered = (products ?? []).filter(p => 
    p.nome.toLowerCase().includes(search.toLowerCase()) || 
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const saveProduct = async (form: any) => {
    if (!barbershop) return;
    const payload = { ...form, barbershop_id: barbershop.id };
    const { error } = modal === 'new' 
      ? await supabase.from('products').insert(payload)
      : await supabase.from('products').update(payload).eq('id', (modal as Product).id);
    
    if (error) return toast.error(error.message);
    toast.success('Produto salvo');
    qc.invalidateQueries({ queryKey: ['products'] });
    setModal(null);
  };

  const saveEdit = async (form: Partial<Product>) => {
    if (!editModal) return;
    const { error } = await supabase.from('products').update(form).eq('id', editModal.id);
    if (error) return toast.error(error.message);
    toast.success('Produto atualizado');
    qc.invalidateQueries({ queryKey: ['products'] });
    setEditModal(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <PageHeader title="Produtos e Estoque" />

      <div className="flex gap-1 border-b border-ink-800 mb-6 overflow-x-auto">
        <button onClick={() => setTab('inventory')} 
          className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors whitespace-nowrap ${tab === 'inventory' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Estoque</button>
        <button onClick={() => setTab('pdv')} 
          className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors whitespace-nowrap ${tab === 'pdv' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Frente de Caixa</button>
        <button onClick={() => setTab('history')} 
          className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors whitespace-nowrap ${tab === 'history' ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>Movimentações</button>
      </div>

      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" size={18} />
              <input className="input pl-10" placeholder="Buscar por nome ou SKU..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={() => setModal('new')}><Plus size={18} /> Novo Produto</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? [1,2,3].map(i => <div key={i} className="card h-48 animate-pulse bg-ink-900/50" />) : 
             filtered.map(p => (
              <div key={p.id} className="card p-4 hover:border-ink-700 transition-colors group flex flex-col justify-between">
                <div>
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-lg bg-ink-900 border border-ink-800 flex items-center justify-center overflow-hidden shrink-0">
                      {p.foto_url ? <img src={p.foto_url} className="w-full h-full object-cover" /> : <Package className="text-ink-700" size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-ink-50 truncate">{p.nome}</h3>
                      <p className="text-[10px] text-ink-500 mb-1">{p.sku || 'Sem SKU'}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-ink-100">{formatBRL(p.preco)}</span>
                        {(p.estoque_geral + p.estoque_fiscal) <= p.estoque_min && <AlertTriangle size={14} className="text-amber-500" title="Estoque Baixo" />}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="text-center p-2 rounded bg-ink-950/50 border border-ink-800/50">
                      <p className="text-[8px] text-ink-500 uppercase font-black tracking-tighter">GERAL (S/ NF)</p>
                      <p className="text-lg font-bold text-ink-100 leading-none mt-1">{p.estoque_geral}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-emerald-500/5 border border-emerald-500/10">
                      <p className="text-[8px] text-emerald-500 uppercase font-black tracking-tighter">PADRÃO (C/ NF)</p>
                      <p className="text-lg font-bold text-emerald-50 leading-none mt-1">{p.estoque_fiscal}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="btn-secondary flex-1 py-1.5 text-[10px] uppercase font-bold" onClick={() => setEditModal(p)}>
                    <Settings2 size={12} className="mr-1" /> Editar & Estoque
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pdv' && <PDVTab products={products ?? []} />}
      {tab === 'history' && <HistoryTab />}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'new' ? 'Novo Produto' : 'Editar Produto'}>
        <ProductForm onSave={saveProduct} />
      </Modal>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Gerenciar Produto">
        {editModal && <EditModal product={editModal} onSave={saveEdit} />}
      </Modal>
    </div>
  );
}

/* ─── helpers ─────────────────────────────────────────────────── */
function EditModal({ product, onSave }: { product: Product; onSave: (v: Partial<Product>) => void }) {
  const { barbershop } = useAuth();
  const [subTab, setSubTab] = useState<'geral' | 'estoque' | 'fiscal'>('geral');
  const [form, setForm] = useState({
    nome: product.nome,
    sku: product.sku ?? '',
    custo: Number(product.custo),
    preco: Number(product.preco),
    foto_url: product.foto_url ?? '',
    comissao_percentual: Number(product.comissao_percentual ?? 0),
    ativo: product.ativo ?? true,
    ncm: product.ncm ?? '',
    cest: product.cest ?? '',
    origem: product.origem ?? 0,
    cfop: product.cfop ?? '5102',
    csosn: product.csosn ?? '102',
    icms_aliquota: Number(product.icms_aliquota ?? 0),
    pis_aliquota: Number(product.pis_aliquota ?? 0),
    cofins_aliquota: Number(product.cofins_aliquota ?? 0),
    estoque_geral: product.estoque_geral ?? 0,
    estoque_fiscal: product.estoque_fiscal ?? 0,
    estoque_min: product.estoque_min ?? 0,
  });
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File) => {
    if (!barbershop) return;
    const ext = file.name.split('.').pop();
    const path = `${barbershop.id}/${product.id}.${ext}`;
    setUploading(true);
    const { error } = await supabase.storage.from('products').upload(path, file, { upsert: true });
    setUploading(false);
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from('products').getPublicUrl(path);
    setForm(prev => ({ ...prev, foto_url: data.publicUrl }));
    toast.success('Foto carregada');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, estoque: form.estoque_geral + form.estoque_fiscal });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[80vh] overflow-y-auto px-1">
      <div className="flex gap-2 border-b border-ink-800 pb-px mb-4">
        {[
          { id: 'geral', label: 'Dados Básicos', icon: Settings2 },
          { id: 'estoque', label: 'Estoque', icon: Calculator },
          { id: 'fiscal', label: 'Fiscal / Impostos', icon: ShieldCheck }
        ].map(t => (
          <button key={t.id} type="button" onClick={() => setSubTab(t.id as any)}
            className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${subTab === t.id ? 'border-ink-50 text-ink-50' : 'border-transparent text-ink-500'}`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {subTab === 'geral' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-hover-soft transition-all relative overflow-hidden shrink-0"
              style={{ borderColor: 'var(--border)' }} onClick={() => inputRef.current?.click()}>
              {form.foto_url ? (
                <>
                  <img src={form.foto_url} alt="foto" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera size={20} className="text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <Camera size={20} className="text-muted" />
                  <span className="text-[10px] text-muted">{uploading ? '...' : 'Foto'}</span>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-4">
              <div><label className="label text-[10px]">Nome do Produto</label><input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label text-[10px]">SKU / Código</label><input className="input" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
                <div><label className="label text-[10px]">Comissão (%)</label><input className="input" type="number" step="0.01" value={form.comissao_percentual} onChange={e => setForm({ ...form, comissao_percentual: +e.target.value })} /></div>
              </div>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-lg bg-ink-900 border border-ink-800">
              <label className="label text-[10px] text-ink-500 mb-1">Preço de Custo</label>
              <div className="flex items-center gap-2">
                <span className="text-ink-500 font-bold">R$</span>
                <input className="bg-transparent border-none p-0 focus:ring-0 text-lg font-bold text-ink-50 w-full" type="number" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: +e.target.value })} />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <label className="label text-[10px] text-emerald-500/70 mb-1">Preço de Venda</label>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold">R$</span>
                <input className="bg-transparent border-none p-0 focus:ring-0 text-lg font-bold text-emerald-50 w-full" type="number" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: +e.target.value })} />
              </div>
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-xs text-ink-300 px-1 cursor-pointer">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} className="rounded border-ink-800" />
            Produto ativo para venda
          </label>
        </div>
      )}

      {subTab === 'estoque' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 space-y-3 bg-ink-900/30">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-ink-500 tracking-tighter">Estoque GERAL (Sem NF)</h4>
                <Package size={14} className="text-ink-700" />
              </div>
              <div className="flex items-center gap-4">
                <button type="button" className="btn-ghost p-2" onClick={() => setForm(f => ({ ...f, estoque_geral: Math.max(0, f.estoque_geral - 1) }))}><X size={14} /></button>
                <input className="bg-transparent border-none p-0 focus:ring-0 text-3xl font-bold text-center w-full text-ink-100" type="number" value={form.estoque_geral} onChange={e => setForm({ ...form, estoque_geral: +e.target.value })} />
                <button type="button" className="btn-ghost p-2" onClick={() => setForm(f => ({ ...f, estoque_geral: f.estoque_geral + 1 }))}><Plus size={14} /></button>
              </div>
              <p className="text-[9px] text-ink-600 text-center italic">Saldo para vendas gerenciais internas.</p>
            </div>

            <div className="card p-4 space-y-3 bg-emerald-500/5 border-emerald-500/10">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-emerald-500 tracking-tighter">Estoque PADRÃO (Com NF)</h4>
                <ShieldCheck size={14} className="text-emerald-700" />
              </div>
              <div className="flex items-center gap-4">
                <button type="button" className="btn-ghost p-2 text-emerald-700" onClick={() => setForm(f => ({ ...f, estoque_fiscal: Math.max(0, f.estoque_fiscal - 1) }))}><X size={14} /></button>
                <input className="bg-transparent border-none p-0 focus:ring-0 text-3xl font-bold text-center w-full text-emerald-50" type="number" value={form.estoque_fiscal} onChange={e => setForm({ ...form, estoque_fiscal: +e.target.value })} />
                <button type="button" className="btn-ghost p-2 text-emerald-700" onClick={() => setForm(f => ({ ...f, estoque_fiscal: f.estoque_fiscal + 1 }))}><Plus size={14} /></button>
              </div>
              <p className="text-[9px] text-emerald-500/40 text-center italic">Saldo para emissão de nota fiscal (NFC-e).</p>
            </div>
          </div>

          <div className="card p-4 bg-ink-900 border-ink-800 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Estoque Mínimo para Alerta</p>
              <p className="text-[9px] text-ink-600">O sistema avisará quando o total (Geral + Padrão) for inferior a este valor.</p>
            </div>
            <input className="input w-20 text-center font-bold" type="number" value={form.estoque_min} onChange={e => setForm({ ...form, estoque_min: +e.target.value })} />
          </div>

          <div className="text-center">
            <span className="text-[10px] font-bold text-ink-500 uppercase tracking-widest">Total em Inventário: </span>
            <span className="text-sm font-bold text-ink-50 ml-1">{form.estoque_geral + form.estoque_fiscal} unidades</span>
          </div>
        </div>
      )}

      {subTab === 'fiscal' && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="bg-ink-900/50 p-4 rounded-lg border border-ink-800 space-y-4">
            <h4 className="text-[10px] font-bold text-ink-400 uppercase tracking-widest flex items-center gap-2"><Receipt size={14} /> Classificação do Produto</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label text-[10px]">NCM (8 dígitos)</label><input className="input" value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} placeholder="Ex: 3305.10.00" /></div>
              <div><label className="label text-[10px]">CEST (7 dígitos)</label><input className="input" value={form.cest} onChange={e => setForm({ ...form, cest: e.target.value })} placeholder="Ex: 28.038.00" /></div>
              <div>
                <label className="label text-[10px]">Origem</label>
                <select className="input text-[10px]" value={form.origem} onChange={e => setForm({ ...form, origem: +e.target.value })}>
                  <option value={0}>0 - Nacional</option>
                  <option value={1}>1 - Estrangeira - Importação Direta</option>
                  <option value={2}>2 - Estrangeira - Adq. Mercado Interno</option>
                </select>
              </div>
              <div><label className="label text-[10px]">CFOP Padrão</label><input className="input" value={form.cfop} onChange={e => setForm({ ...form, cfop: e.target.value })} /></div>
            </div>
          </div>

          <div className="bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/10 space-y-4">
            <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2"><Calculator size={14} /> Alíquotas de Impostos</h4>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label text-[10px]">CSOSN / CST</label><input className="input" value={form.csosn} onChange={e => setForm({ ...form, csosn: e.target.value })} /></div>
              <div><label className="label text-[10px]">ICMS (%)</label><input className="input" type="number" step="0.01" value={form.icms_aliquota} onChange={e => setForm({ ...form, icms_aliquota: +e.target.value })} /></div>
              <div><label className="label text-[10px]">PIS (%)</label><input className="input" type="number" step="0.01" value={form.pis_aliquota} onChange={e => setForm({ ...form, pis_aliquota: +e.target.value })} /></div>
              <div><label className="label text-[10px]">COFINS (%)</label><input className="input" type="number" step="0.01" value={form.cofins_aliquota} onChange={e => setForm({ ...form, cofins_aliquota: +e.target.value })} /></div>
            </div>
            <p className="text-[9px] text-emerald-500/50 leading-relaxed italic">
              * Deixe as alíquotas zeradas para usar o padrão configurado globalmente nas Configurações Fiscais da barbearia.
            </p>
          </div>
        </div>
      )}

      <div className="pt-6 border-t border-ink-800 flex gap-3">
        <button type="button" className="btn-ghost flex-1 py-3 text-xs uppercase font-bold" onClick={() => onSave({})}>Cancelar</button>
        <button type="submit" className="btn-primary flex-[2] py-3 text-xs uppercase font-bold flex items-center justify-center gap-2">
          <Save size={16} /> Salvar Alterações
        </button>
      </div>
    </form>
  );
}

function ProductForm({ onSave }: { onSave: (v: any) => void }) {
  const [form, setForm] = useState({
    nome: '', sku: '', custo: 0, preco: 0,
    estoque_min: 5, comissao_percentual: 0, ativo: true,
    ncm: '', cest: '', origem: 0, cfop: '5102', csosn: '102',
    icms_aliquota: 0, pis_aliquota: 0, cofins_aliquota: 0,
    estoque_geral: 0, estoque_fiscal: 0,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...form, estoque: form.estoque_geral + form.estoque_fiscal }); }} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="label text-[10px]">Nome do Produto</label><input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required autoFocus /></div>
        <div><label className="label text-[10px]">Preço de Venda</label><input className="input font-bold text-emerald-50" type="number" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: +e.target.value })} required /></div>
        <div><label className="label text-[10px]">Custo</label><input className="input" type="number" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: +e.target.value })} /></div>
      </div>

      <div className="pt-4 border-t border-ink-800 space-y-3">
        <h4 className="text-[10px] font-black uppercase text-ink-500 tracking-widest">Estoque de Abertura</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label text-[10px]">Saldo GERAL</label><input className="input" type="number" value={form.estoque_geral} onChange={e => setForm({ ...form, estoque_geral: +e.target.value })} /></div>
          <div><label className="label text-[10px]">Saldo PADRÃO (Fiscal)</label><input className="input border-emerald-500/20" type="number" value={form.estoque_fiscal} onChange={e => setForm({ ...form, estoque_fiscal: +e.target.value })} /></div>
        </div>
      </div>

      <div className="pt-4 border-t border-ink-800 space-y-3">
        <h4 className="text-[10px] font-black uppercase text-ink-500 tracking-widest">Informações Fiscais Básicas</h4>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label text-[10px]">NCM</label><input className="input" value={form.ncm} onChange={e => setForm({ ...form, ncm: e.target.value })} placeholder="Ex: 3305.10.00" /></div>
          <div><label className="label text-[10px]">CEST</label><input className="input" value={form.cest} onChange={e => setForm({ ...form, cest: e.target.value })} placeholder="Ex: 28.038.00" /></div>
          <div><label className="label text-[10px]">CFOP Padrão</label><input className="input" value={form.cfop} onChange={e => setForm({ ...form, cfop: e.target.value })} /></div>
          <div><label className="label text-[10px]">CSOSN / CST</label><input className="input" value={form.csosn} onChange={e => setForm({ ...form, csosn: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="label text-[10px]">ICMS (%)</label><input className="input" type="number" step="0.01" value={form.icms_aliquota} onChange={e => setForm({ ...form, icms_aliquota: +e.target.value })} /></div>
          <div><label className="label text-[10px]">PIS (%)</label><input className="input" type="number" step="0.01" value={form.pis_aliquota} onChange={e => setForm({ ...form, pis_aliquota: +e.target.value })} /></div>
          <div><label className="label text-[10px]">COFINS (%)</label><input className="input" type="number" step="0.01" value={form.cofins_aliquota} onChange={e => setForm({ ...form, cofins_aliquota: +e.target.value })} /></div>
        </div>
      </div>

      <button className="btn-primary w-full py-3 mt-4 text-[11px] font-black uppercase tracking-widest">Cadastrar Produto</button>
    </form>
  );
}

function PDVTab({ products }: { products: Product[] }) {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [cart, setCart] = useState<{ product: Product; qtd: number }[]>([]);
  const [pagamento, setPagamento] = useState<any>('dinheiro');
  const [desconto, setDesconto] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ total: number } | null>(null);

  const total = cart.reduce((acc, item) => acc + (item.product.preco * item.qtd), 0) - desconto;

  const addToCart = (p: Product) => {
    const existing = cart.find(item => item.product.id === p.id);
    if (existing) {
      setCart(cart.map(item => item.product.id === p.id ? { ...item, qtd: item.qtd + 1 } : item));
    } else {
      setCart([...cart, { product: p, qtd: 1 }]);
    }
  };

  const finalize = async () => {
    if (!barbershop || cart.length === 0) return toast.error('Carrinho vazio');
    setLoading(true);
    let orderId: string | null = null;
    
    for (const item of cart) {
      const { data, error } = await supabase.rpc('product_pdv_sale', {
        p_barbershop_id: barbershop.id,
        p_product_id: item.product.id,
        p_qtd: item.qtd,
        p_forma: pagamento,
        p_desconto: item.qtd === cart[cart.length - 1].qtd ? desconto : 0,
      });
      if (error) {
        setLoading(false);
        return toast.error(`${item.product.nome}: ${error.message}`);
      }
      if (data) orderId = data;
    }

    if (barbershop.fiscal_enabled && orderId) {
      try {
        await supabase.functions.invoke('emit-fiscal-note', {
          body: { orderId, barbershopId: barbershop.id, type: 'nfce' }
        });
        toast.success('Nota Fiscal em processamento');
      } catch (err) {
        console.error('Fiscal emission failed:', err);
        toast.error('Erro ao iniciar emissão fiscal');
      }
    }

    qc.invalidateQueries({ queryKey: ['products'] });
    setDone({ total });
    setCart([]);
    setDesconto(0);
    setLoading(false);
  };

  if (done) {
    return (
      <div className="card p-12 text-center space-y-6 animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
          <Check size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-ink-50">Venda Finalizada!</h2>
          <p className="text-ink-500 mt-1">Total recebido: {formatBRL(done.total)}</p>
        </div>
        <button className="btn-primary w-full max-w-xs mx-auto" onClick={() => setDone(null)}>Nova Venda</button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {products.filter(p => p.ativo).map(p => (
            <button key={p.id} onClick={() => addToCart(p)}
              className="card p-3 text-left hover:border-ink-50 transition-colors flex flex-col gap-2 group">
              <div className="aspect-square rounded bg-ink-900 border border-ink-800 flex items-center justify-center overflow-hidden">
                {p.foto_url ? <img src={p.foto_url} className="w-full h-full object-cover" /> : <Package size={20} className="text-ink-700" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-ink-50 truncate leading-tight mb-1">{p.nome}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-500">{formatBRL(p.preco)}</span>
                  <span className="text-[9px] text-ink-500 font-medium">Qtd: {p.estoque_geral + p.estoque_fiscal}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card flex flex-col h-[500px]">
          <div className="p-4 border-b border-ink-800 flex items-center justify-between">
            <h3 className="font-bold text-ink-100 flex items-center gap-2"><Receipt size={16} /> Carrinho</h3>
            <span className="text-[10px] text-ink-500 uppercase font-bold tracking-widest">{cart.length} itens</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map(item => (
              <div key={item.product.id} className="flex justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-ink-50 truncate">{item.product.nome}</div>
                  <div className="text-[10px] text-ink-500">{item.qtd}x {formatBRL(item.product.preco)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1 text-ink-500 hover:text-red-400" onClick={() => setCart(cart.filter(c => c.product.id !== item.product.id))}><X size={14} /></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-ink-600 space-y-2 italic">
                <Package size={32} strokeWidth={1} />
                <p className="text-xs">Carrinho vazio</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-ink-900/50 border-t border-ink-800 space-y-3">
            <div className="flex justify-between items-center text-ink-400 text-xs">
              <span>Desconto</span>
              <input type="number" className="bg-transparent border-none text-right w-16 focus:ring-0 p-0 text-ink-100 font-bold" 
                value={desconto} onChange={e => setDesconto(+e.target.value)} />
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-ink-50">
              <span>Total</span>
              <span>{formatBRL(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select className="input py-2 text-xs" value={pagamento} onChange={e => setPagamento(e.target.value)}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
              <button className="btn-primary py-2" onClick={finalize} disabled={loading || cart.length === 0}>
                {loading ? 'Processando…' : 'Finalizar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryTab() {
  return (
    <div className="card p-12 text-center text-ink-600 italic border-dashed">
      <History size={32} className="mx-auto mb-3 opacity-20" />
      <p className="text-xs">Histórico de movimentações em tempo real</p>
    </div>
  );
}
