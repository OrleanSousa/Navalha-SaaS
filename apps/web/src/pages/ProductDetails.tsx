import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Boxes, Package, Save } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

type MovementType = 'ENTRY' | 'ADJUSTMENT' | 'LOSS' | 'RETURN' | 'SALE';
type Product = {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  costPrice: string | number;
  salePrice: string | number;
  stockQuantity: number;
  minimumStock: number;
  active: boolean;
  lowStock: boolean;
  category?: { name: string } | null;
  movements: Array<{
    id: string;
    type: MovementType;
    quantity: number;
    reason?: string | null;
    createdAt: string;
    user: { name: string };
  }>;
};
const labels: Record<MovementType, string> = {
  ENTRY: 'Entrada',
  ADJUSTMENT: 'Ajuste',
  LOSS: 'Perda',
  RETURN: 'Devolução',
  SALE: 'Venda',
};

export function ProductDetails() {
  const { id } = useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    type: 'ENTRY' as Exclude<MovementType, 'SALE'>,
    quantity: '1',
    reason: '',
  });
  const { data, isLoading, isError } = useQuery<Product>({
    queryKey: ['product-details', id],
    queryFn: async () => (await api.get(`/products/${id}`)).data,
    enabled: Boolean(id),
  });
  const movement = useMutation({
    mutationFn: () =>
      api.post(`/products/${id}/movements`, {
        type: form.type,
        quantity: Number(form.quantity),
        reason: form.reason || undefined,
      }),
    onSuccess: async () => {
      toast.success('Movimentação registrada');
      setForm({ type: 'ENTRY', quantity: '1', reason: '' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['product-details', id] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível movimentar o estoque'),
  });
  if (isLoading) return <div className="empty big">Carregando produto...</div>;
  if (isError || !data)
    return (
      <div className="empty big">
        <Package />
        <p>Não foi possível carregar o produto.</p>
        <Link className="outline" to="/produtos">
          <ArrowLeft /> Voltar
        </Link>
      </div>
    );
  return (
    <div className="page product-details-page">
      <Link className="employee-back" to="/produtos">
        <ArrowLeft /> Produtos
      </Link>
      <div className="service-profile card">
        <span>
          <Package />
        </span>
        <div>
          <small>{data.category?.name || 'Sem categoria'}</small>
          <h2>{data.name}</h2>
          <p>{data.description || 'Sem descrição cadastrada.'}</p>
        </div>
        <i className={data.active ? 'on' : 'off'}>{data.active ? 'ATIVO' : 'INATIVO'}</i>
      </div>
      <div className="service-detail-metrics">
        <div className="card">
          <b>{money(Number(data.salePrice))}</b>
          <small>Preço de venda</small>
        </div>
        <div className="card">
          <b>{money(Number(data.costPrice))}</b>
          <small>Preço de custo</small>
        </div>
        <div className={`card ${data.lowStock ? 'metric-alert' : ''}`}>
          <b>
            {data.lowStock && <AlertTriangle />} {data.stockQuantity}
          </b>
          <small>Saldo atual</small>
        </div>
        <div className="card">
          <b>
            <Boxes /> {data.minimumStock}
          </b>
          <small>Estoque mínimo</small>
        </div>
      </div>
      <div className="product-code-band card">
        <span>
          <small>SKU</small>
          <b>{data.sku || '—'}</b>
        </span>
        <span>
          <small>Código de barras</small>
          <b>{data.barcode || '—'}</b>
        </span>
      </div>
      {can(Permissions.PRODUCTS_STOCK) && (
        <form
          className="card movement-form"
          onSubmit={(e) => {
            e.preventDefault();
            movement.mutate();
          }}
        >
          <div>
            <h3>Nova movimentação</h3>
            <p>
              Entradas e devoluções somam; perdas subtraem. No ajuste, use valor positivo ou
              negativo.
            </p>
          </div>
          <label>
            Tipo
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
            >
              <option value="ENTRY">Entrada</option>
              <option value="ADJUSTMENT">Ajuste</option>
              <option value="LOSS">Perda</option>
              <option value="RETURN">Devolução</option>
            </select>
          </label>
          <label>
            Quantidade
            <input
              required
              type="number"
              min={form.type === 'ADJUSTMENT' ? undefined : '1'}
              step="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </label>
          <label>
            Motivo
            <input
              required={form.type === 'LOSS' || form.type === 'ADJUSTMENT'}
              maxLength={300}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </label>
          <button className="primary" disabled={movement.isPending}>
            <Save /> Registrar
          </button>
        </form>
      )}
      <section className="inventory-history">
        <div className="detail-section-head">
          <div>
            <h3>Extrato de estoque</h3>
            <p>As 100 movimentações mais recentes.</p>
          </div>
        </div>
        {!data.movements.length ? (
          <div className="empty card">Nenhuma movimentação registrada.</div>
        ) : (
          <div className="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Motivo</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {data.movements.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(item.createdAt))}
                    </td>
                    <td>{labels[item.type]}</td>
                    <td className={item.quantity > 0 ? 'positive' : 'negative'}>
                      {item.quantity > 0 ? '+' : ''}
                      {item.quantity}
                    </td>
                    <td>{item.reason || '—'}</td>
                    <td>{item.user.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
