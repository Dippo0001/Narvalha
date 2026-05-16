import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import {
  Plus, Package, AlertTriangle, Pencil, Camera, X,
  ShoppingCart, Minus, Trash2, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatBRL } from '../lib/utils';
import type { Product } from '../types/db';

type Tab = 'estoque' | 'pdv';

interface CartItem { product: Product; qtd: number }

export default function Products() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader title="Produtos" subtitle="Gestão de estoque e catálogo" />
      <EstoqueTab />
    </div>
  );
}

const PRODUCT_LIMITS: Record<string, number> = { silver: 10, gold: 20, platinum: 999, trial: 999 };

/* ─── Estoque ──────────────────────────────────────────────────── */
function EstoqueTab() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [modal, setModal] = useState<Product | 'new' | null>(null);
  const [stockModal, setStockModal] = useState<Product | null>(null);
  const [editModal, setEditModal] = useState<Product | null>(null);

  const { data: products } = useQuery({
... rest of query ...
  });

  const canAddProduct = (products?.length ?? 0) < PRODUCT_LIMITS[barbershop?.plan || 'silver'];

  const save = async (form: Partial<Product>) => {
... rest of save ...
  };

... rest of helper functions ...

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="text-xs text-ink-500 font-medium">
          Capacidade do catálogo: <span className="text-ink-300 font-bold">{products?.length ?? 0} de {PRODUCT_LIMITS[barbershop?.plan || 'silver']}</span>
        </div>
        <button 
          className="btn-primary" 
          disabled={!canAddProduct}
          onClick={() => {
            if (!canAddProduct) return toast.error('Limite de produtos atingido. Faça upgrade para aumentar seu catálogo!');
            setModal('new');
          }}
        >
          <Plus size={15} /> Novo produto
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="text-left p-4 text-xs font-medium text-muted uppercase tracking-wide w-14"></th>
              <th className="text-left p-4 text-xs font-medium text-muted uppercase tracking-wide">Produto</th>
              <th className="text-left text-xs font-medium text-muted uppercase tracking-wide">SKU</th>
              <th className="text-right text-xs font-medium text-muted uppercase tracking-wide">Custo</th>
              <th className="text-right text-xs font-medium text-muted uppercase tracking-wide">Preço</th>
              <th className="text-right text-xs font-medium text-muted uppercase tracking-wide pr-4">Estoque</th>
              <th className="p-4 text-xs font-medium text-muted uppercase tracking-wide text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {(!products || products.length === 0) && (
              <tr><td colSpan={7} className="p-12 text-center">
                <Package size={32} className="mx-auto text-muted mb-3" />
                <p className="text-muted text-sm">Nenhum produto cadastrado</p>
              </td></tr>
            )}
            {(products ?? []).map((p) => {
              const low = p.estoque <= p.estoque_min;
              return (
                <tr key={p.id} className="hover:bg-hover-soft transition-colors">
                  <td className="pl-4 py-3">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt={p.nome} className="w-10 h-10 rounded-md object-cover border" style={{ borderColor: 'var(--border)' }} />
                    ) : (
                      <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-hover)' }}>
                        <Package size={16} className="text-muted" />
                      </div>
                    )}
                  </td>
                  <td className="py-3 font-medium">{p.nome}{!p.ativo && <span className="ml-2 text-xs text-muted">inativo</span>}</td>
                  <td className="text-muted">{p.sku || '—'}</td>
                  <td className="text-right text-muted">{formatBRL(Number(p.custo))}</td>
                  <td className="text-right font-medium">{formatBRL(Number(p.preco))}</td>
                  <td className="text-right pr-4">
                    <span className={low ? 'text-amber-400' : ''}>
                      {low && <AlertTriangle size={12} className="inline mr-1" />}
                      {p.estoque}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditModal(p)} className="btn-ghost px-2 py-1.5 text-xs gap-1.5">
                        <Pencil size={13} /> Editar
                      </button>
                      <button className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setStockModal(p)}>
                        + Estoque
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modal === 'new'} onClose={() => setModal(null)} title="Novo produto">
        <ProductForm initial={null} onSave={save} />
      </Modal>
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Editar — ${editModal?.nome ?? ''}`}>
        {editModal && <EditModal product={editModal} onSave={saveEdit} />}
      </Modal>
      <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={`Entrada de estoque — ${stockModal?.nome ?? ''}`}>
        {stockModal && <StockForm onSave={(qtd, motivo) => addStock(stockModal, qtd, motivo)} />}
      </Modal>
    </>
  );
}

/* ─── PDV tab ──────────────────────────────────────────────────── */
function PDVTab() {
  const { barbershop } = useAuth();
  const qc = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [pagamento, setPagamento] = useState('pix');
  const [done, setDone] = useState<{ total: number } | null>(null);

  const { data: products } = useQuery({
    queryKey: ['products', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome');
      return (data ?? []) as Product[];
    },
  });

  const { data: payMethods } = useQuery({
    queryKey: ['payment_methods', barbershop?.id],
    enabled: !!barbershop,
    queryFn: async () => {
      const { data } = await supabase.from('payment_methods').select('*')
        .eq('barbershop_id', barbershop!.id).eq('ativo', true).order('nome');
      return data ?? [];
    },
  });

  const addToCart = (p: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === p.id);
      if (existing) {
        if (existing.qtd >= p.estoque) { toast.error('Estoque insuficiente'); return prev; }
        return prev.map(i => i.product.id === p.id ? { ...i, qtd: i.qtd + 1 } : i);
      }
      if (p.estoque <= 0) { toast.error('Sem estoque'); return prev; }
      return [...prev, { product: p, qtd: 1 }];
    });
  };

  const changeQtd = (id: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== id) return i;
      const next = i.qtd + delta;
      if (next <= 0) return i;
      if (next > i.product.estoque) { toast.error('Estoque insuficiente'); return i; }
      return { ...i, qtd: next };
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.product.id !== id));

  const subtotal = cart.reduce((s, i) => s + Number(i.product.preco) * i.qtd, 0);
  const total = Math.max(0, subtotal - desconto);

  const finalize = async () => {
    if (!barbershop || cart.length === 0) return toast.error('Carrinho vazio');
    for (const item of cart) {
      const { error } = await supabase.rpc('product_pdv_sale', {
        p_barbershop_id: barbershop.id,
        p_product_id: item.product.id,
        p_qtd: item.qtd,
        p_forma: pagamento,
        p_desconto: item.qtd === cart[cart.length - 1].qtd ? desconto : 0,
      });
      if (error) return toast.error(`${item.product.nome}: ${error.message}`);
    }
    qc.invalidateQueries({ queryKey: ['products'] });
    setDone({ total });
    setCart([]);
    setDesconto(0);
  };

  if (done) return (
    <div className="card p-12 text-center">
      <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
      <p className="text-xl font-semibold mb-1">Venda finalizada!</p>
      <p className="text-muted mb-6">Total cobrado: <strong>{formatBRL(done.total)}</strong></p>
      <button className="btn-primary mx-auto" onClick={() => setDone(null)}>Nova venda</button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* product grid */}
      <div className="lg:col-span-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(!products || products.length === 0) && (
            <div className="col-span-3 card p-8 text-center text-muted text-sm">
              Nenhum produto ativo cadastrado.
            </div>
          )}
          {(products ?? []).map((p) => {
            const inCart = cart.find(i => i.product.id === p.id);
            const outOfStock = p.estoque <= 0;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={outOfStock}
                className={`card p-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 relative ${inCart ? 'ring-2' : ''}`}
                style={inCart ? { '--tw-ring-color': 'var(--text)' } as any : {}}
              >
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.nome} className="w-full h-24 object-cover rounded-md mb-2" />
                ) : (
                  <div className="w-full h-24 rounded-md flex items-center justify-center mb-2" style={{ background: 'var(--bg-hover)' }}>
                    <Package size={24} className="text-muted" />
                  </div>
                )}
                <div className="text-sm font-medium leading-tight truncate">{p.nome}</div>
                <div className="text-xs text-muted mt-0.5">{formatBRL(Number(p.preco))}</div>
                <div className={`text-[10px] mt-1 ${p.estoque <= p.estoque_min ? 'text-amber-400' : 'text-muted'}`}>
                  {outOfStock ? 'Sem estoque' : `${p.estoque} em estoque`}
                </div>
                {inCart && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                    {inCart.qtd}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* cart */}
      <div className="card p-4 space-y-4 h-fit lg:sticky lg:top-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ShoppingCart size={16} /> Carrinho
        </h3>

        {cart.length === 0 && (
          <p className="text-xs text-muted text-center py-4">Clique em um produto para adicionar</p>
        )}

        <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
          {cart.map((item) => (
            <div key={item.product.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.product.nome}</div>
                <div className="text-xs text-muted">{formatBRL(Number(item.product.preco))} × {item.qtd}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => changeQtd(item.product.id, -1)} className="btn-ghost p-1"><Minus size={12} /></button>
                <span className="text-sm w-5 text-center">{item.qtd}</span>
                <button onClick={() => changeQtd(item.product.id, 1)} className="btn-ghost p-1"><Plus size={12} /></button>
                <button onClick={() => removeFromCart(item.product.id)} className="btn-ghost p-1 text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <>
            <hr style={{ borderColor: 'var(--border)' }} />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span><span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-muted">
                <span>Desconto</span>
                <input className="input w-24 text-right text-sm py-1" type="number" step="0.01" min={0}
                  value={desconto} onChange={e => setDesconto(+e.target.value)} />
              </div>
              <div className="flex justify-between font-semibold text-base pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <span>Total</span><span>{formatBRL(total)}</span>
              </div>
            </div>

            <div>
              <label className="label">Forma de pagamento</label>
              <select className="input" value={pagamento} onChange={e => setPagamento(e.target.value)}>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
                {(payMethods ?? []).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>

            <button onClick={finalize} className="btn-primary w-full">
              Finalizar venda · {formatBRL(total)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── helpers ─────────────────────────────────────────────────── */
function EditModal({ product, onSave }: { product: Product; onSave: (v: { custo: number; preco: number; foto_url: string }) => void }) {
  const { barbershop } = useAuth();
  const [custo, setCusto] = useState(Number(product.custo));
  const [preco, setPreco] = useState(Number(product.preco));
  const [fotoUrl, setFotoUrl] = useState(product.foto_url ?? '');
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
    setFotoUrl(data.publicUrl);
    toast.success('Foto carregada');
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ custo, preco, foto_url: fotoUrl }); }} className="space-y-5">
      <div>
        <label className="label">Foto do produto</label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-hover-soft transition-colors relative overflow-hidden"
            style={{ borderColor: 'var(--border)' }} onClick={() => inputRef.current?.click()}>
            {fotoUrl ? (
              <>
                <img src={fotoUrl} alt="foto" className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                  <Camera size={20} className="text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Camera size={20} className="text-muted" />
                <span className="text-[10px] text-muted">{uploading ? 'Enviando…' : 'Clique'}</span>
              </div>
            )}
          </div>
          <div className="flex-1 text-xs text-muted">
            <p>JPG ou PNG, até 5MB.</p>
            {fotoUrl && (
              <button type="button" className="flex items-center gap-1 mt-2 text-red-400 hover:text-red-300" onClick={() => setFotoUrl('')}>
                <X size={12} /> Remover foto
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Custo (R$)</label>
          <input className="input" type="number" step="0.01" min={0} value={custo} onChange={(e) => setCusto(+e.target.value)} required />
        </div>
        <div>
          <label className="label">Preço de venda (R$)</label>
          <input className="input" type="number" step="0.01" min={0} value={preco} onChange={(e) => setPreco(+e.target.value)} required />
        </div>
      </div>
      {preco > 0 && custo > 0 && (
        <p className="text-xs text-muted">Margem: {(((preco - custo) / preco) * 100).toFixed(1)}% · Lucro por unidade: {formatBRL(preco - custo)}</p>
      )}
      <button className="btn-primary w-full" disabled={uploading}>Salvar alterações</button>
    </form>
  );
}

function ProductForm({ initial, onSave }: { initial: Product | null; onSave: (v: any) => void }) {
  const [form, setForm] = useState({
    nome: initial?.nome ?? '', sku: initial?.sku ?? '',
    custo: Number(initial?.custo ?? 0), preco: Number(initial?.preco ?? 0),
    estoque: initial?.estoque ?? 0, estoque_min: initial?.estoque_min ?? 0,
    comissao_percentual: Number(initial?.comissao_percentual ?? 0),
    ativo: initial?.ativo ?? true, foto_url: initial?.foto_url ?? '',
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div><label className="label">Nome</label>
        <input className="input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required autoFocus /></div>
      <div><label className="label">SKU</label>
        <input className="input" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Custo</label>
          <input className="input" type="number" step="0.01" value={form.custo} onChange={e => setForm({ ...form, custo: +e.target.value })} /></div>
        <div><label className="label">Preço</label>
          <input className="input" type="number" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: +e.target.value })} /></div>
        <div><label className="label">Estoque inicial</label>
          <input className="input" type="number" value={form.estoque} onChange={e => setForm({ ...form, estoque: +e.target.value })} /></div>
        <div><label className="label">Estoque mín.</label>
          <input className="input" type="number" value={form.estoque_min} onChange={e => setForm({ ...form, estoque_min: +e.target.value })} /></div>
        <div><label className="label">Comissão (%)</label>
          <input className="input" type="number" step="0.01" value={form.comissao_percentual} onChange={e => setForm({ ...form, comissao_percentual: +e.target.value })} /></div>
      </div>
      <button className="btn-primary w-full">Criar produto</button>
    </form>
  );
}

function StockForm({ onSave }: { onSave: (qtd: number, motivo: string) => void }) {
  const [qtd, setQtd] = useState(1);
  const [motivo, setMotivo] = useState('Compra');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(qtd, motivo); }} className="space-y-4">
      <div><label className="label">Quantidade</label>
        <input className="input" type="number" min={1} value={qtd} onChange={e => setQtd(+e.target.value)} /></div>
      <div><label className="label">Motivo</label>
        <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
      <button className="btn-primary w-full">Registrar entrada</button>
    </form>
  );
}
