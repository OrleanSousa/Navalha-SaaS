import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Eye,
  Package,
  Pencil,
  Plus,
  Power,
  Save,
  Settings2,
  Tags,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

type Category = { id: string; name: string };
type Product = {
  id: string;
  name: string;
  description?: string | null;
  category?: Category | null;
  sku?: string | null;
  barcode?: string | null;
  costPrice: string | number;
  salePrice: string | number;
  stockQuantity: number;
  minimumStock: number;
  commissionPercent?: string | number | null;
  active: boolean;
  lowStock: boolean;
};
const emptyForm = {
  name: '',
  description: '',
  categoryId: '',
  sku: '',
  barcode: '',
  costPrice: '',
  salePrice: '',
  minimumStock: '0',
  commissionPercent: '',
};

export function ProductCatalog() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/products')).data,
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['product-categories'],
    queryFn: async () => (await api.get('/products/categories')).data,
  });
  const { data: settings } = useQuery<{ allowNegativeStock: boolean }>({
    queryKey: ['stock-settings'],
    queryFn: async () => (await api.get('/products/settings/stock')).data,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        categoryId: form.categoryId || null,
        sku: form.sku || null,
        barcode: form.barcode || null,
        costPrice: Number(form.costPrice),
        salePrice: Number(form.salePrice),
        minimumStock: Number(form.minimumStock),
        commissionPercent: form.commissionPercent === '' ? null : Number(form.commissionPercent),
      };
      return editingId
        ? api.patch(`/products/${editingId}`, payload)
        : api.post('/products', payload);
    },
    onSuccess: async () => {
      toast.success(editingId ? 'Produto atualizado' : 'Produto cadastrado');
      closeForm();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível salvar o produto'),
  });
  const createCategory = useMutation({
    mutationFn: () => api.post('/products/categories', { name: categoryName }),
    onSuccess: async () => {
      toast.success('Categoria cadastrada');
      setCategoryName('');
      setShowCategory(false);
      await queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível cadastrar a categoria'),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/products/${id}/status`, { active }),
    onSuccess: async (_, { active }) => {
      toast.success(active ? 'Produto ativado' : 'Produto inativado');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível alterar o status'),
  });
  const updateSettings = useMutation({
    mutationFn: (allowNegativeStock: boolean) =>
      api.patch('/products/settings/stock', { allowNegativeStock }),
    onSuccess: async () => {
      toast.success('Regra de estoque atualizada');
      await queryClient.invalidateQueries({ queryKey: ['stock-settings'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível atualizar a regra'),
  });

  function closeForm() {
    setShowForm(false);
    setEditingId(undefined);
    setForm(emptyForm);
  }
  function edit(product: Product) {
    setEditingId(product.id);
    setShowForm(true);
    setForm({
      name: product.name,
      description: product.description || '',
      categoryId: product.category?.id || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      costPrice: String(product.costPrice),
      salePrice: String(product.salePrice),
      minimumStock: String(product.minimumStock),
      commissionPercent: String(product.commissionPercent ?? ''),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page product-page">
      <div className="module-head">
        <div>
          <h2>Produtos e estoque</h2>
          <p>Controle o catálogo, saldos e movimentações.</p>
        </div>
        <div className="service-head-actions">
          {can(Permissions.PRODUCTS_CATEGORIES) && (
            <button className="outline" onClick={() => setShowCategory((v) => !v)}>
              <Tags /> Categorias
            </button>
          )}
          {can(Permissions.PRODUCTS_CREATE) && !showForm && (
            <button className="primary" onClick={() => setShowForm(true)}>
              <Plus /> Novo produto
            </button>
          )}
        </div>
      </div>
      {can(Permissions.PRODUCTS_SETTINGS) && settings && (
        <div className="card stock-setting">
          <Settings2 />
          <div>
            <b>Permitir estoque negativo</b>
            <small>Quando desativado, perdas e ajustes nunca podem ultrapassar o saldo.</small>
          </div>
          <label className="permission-active-toggle">
            <input
              type="checkbox"
              checked={settings.allowNegativeStock}
              disabled={updateSettings.isPending}
              onChange={(e) => updateSettings.mutate(e.target.checked)}
            />
            <span />
          </label>
        </div>
      )}
      {showCategory && (
        <form
          className="card category-form"
          onSubmit={(e) => {
            e.preventDefault();
            createCategory.mutate();
          }}
        >
          <label>
            Nova categoria
            <input
              required
              minLength={2}
              maxLength={80}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </label>
          <button className="primary" disabled={createCategory.isPending}>
            <Save /> Salvar
          </button>
        </form>
      )}
      {showForm && (
        <form
          className="card service-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="service-form-head">
            <div>
              <h3>{editingId ? 'Editar produto' : 'Novo produto'}</h3>
              <p>Cadastre a identificação, os preços e o estoque mínimo.</p>
            </div>
            <button className="icon" type="button" onClick={closeForm}>
              <X />
            </button>
          </div>
          <div className="service-form-grid">
            <label>
              Nome
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Categoria
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              SKU
              <input
                maxLength={80}
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </label>
            <label>
              Código de barras
              <input
                maxLength={80}
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </label>
            <label>
              Preço de custo
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </label>
            <label>
              Preço de venda
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              />
            </label>
            <label>
              Estoque mínimo
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.minimumStock}
                onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
              />
            </label>
            <label>
              Comissão (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.commissionPercent}
                onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
              />
            </label>
            <label className="wide">
              Descrição
              <textarea
                maxLength={1000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
          </div>
          <div className="service-form-actions">
            <button className="outline" type="button" onClick={closeForm}>
              Cancelar
            </button>
            <button className="primary" disabled={save.isPending}>
              <Save /> {save.isPending ? 'Salvando...' : 'Salvar produto'}
            </button>
          </div>
        </form>
      )}
      {isLoading && <div className="empty card">Carregando produtos...</div>}
      {isError && (
        <div className="empty card catalog-error">
          Não foi possível carregar os produtos.
          <button className="outline" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {!isLoading && !isError && (
        <div className="catalog-grid">
          {data.map((item) => (
            <article
              className={`card catalog product-card ${item.lowStock ? 'low-stock' : ''}`}
              key={item.id}
            >
              <span className="catalog-icon">
                <Package />
              </span>
              <i className={item.active ? 'on' : 'off'}>{item.active ? 'ATIVO' : 'INATIVO'}</i>
              <h3>{item.name}</h3>
              <p>{item.category?.name || item.description || 'Sem categoria'}</p>
              <div>
                <b>{money(Number(item.salePrice))}</b>
                <small className={item.lowStock ? 'stock-warning' : ''}>
                  {item.lowStock && <AlertTriangle />} {item.stockQuantity} em estoque
                </small>
              </div>
              <footer className="catalog-actions">
                <Link className="icon" title="Estoque e detalhes" to={`/produtos/${item.id}`}>
                  <Eye />
                </Link>
                {can(Permissions.PRODUCTS_UPDATE) && (
                  <button className="icon" title="Editar" onClick={() => edit(item)}>
                    <Pencil />
                  </button>
                )}
                {can(Permissions.PRODUCTS_STATUS) && (
                  <button
                    className="icon"
                    title={item.active ? 'Inativar' : 'Ativar'}
                    onClick={() => setStatus.mutate({ id: item.id, active: !item.active })}
                  >
                    <Power />
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
      {!isLoading && !isError && !data.length && (
        <div className="empty card">Nenhum produto cadastrado.</div>
      )}
    </div>
  );
}
