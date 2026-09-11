import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, RotateCcw, TicketPercent, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';

type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
type Invoice = {
  id: string;
  number: string;
  total: string | number;
  dueDate: string;
  status: InvoiceStatus;
  barbershop: { id: string; name: string };
  payments: Array<{ id: string; amount: string | number; status: string }>;
  couponRedemption?: { discount: string | number; coupon: { code: string } };
};
type BillingResponse = {
  items: Invoice[];
  total: number;
  summary: Record<string, { count: number; total: number }>;
};
type TenantResponse = { items: Array<{ id: string; name: string }> };
type Coupon = {
  id: string;
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  value: string | number;
  validUntil?: string;
  maxRedemptions?: number;
  active: boolean;
  _count: { redemptions: number };
};

const statusLabel: Record<InvoiceStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
  REFUNDED: 'Estornada',
};

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

function errorMessage(error: any) {
  const value = error.response?.data?.message;
  return Array.isArray(value) ? value[0] : value || 'Não foi possível concluir a operação';
}

export function SuperBilling() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showCouponForm, setShowCouponForm] = useState(false);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({
    barbershopId: '',
    amount: '',
    discount: '0',
    dueDate: defaultDueDate(),
    notes: '',
    couponCode: '',
  });
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    value: '',
    validUntil: '',
    maxRedemptions: '',
  });
  const { data, isLoading } = useQuery<BillingResponse>({
    queryKey: ['super-admin', 'invoices', status],
    queryFn: async () =>
      (await api.get('/super-admin/invoices', { params: status ? { status } : {} })).data,
  });
  const { data: tenants } = useQuery<TenantResponse>({
    queryKey: ['super-admin', 'barbershops', 'billing-select'],
    queryFn: async () =>
      (await api.get('/super-admin/barbershops', { params: { limit: 50 } })).data,
  });
  const { data: coupons = [] } = useQuery<Coupon[]>({
    queryKey: ['super-admin', 'coupons'],
    queryFn: async () => (await api.get('/super-admin/coupons')).data,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'invoices'] });
  const createInvoice = useMutation({
    mutationFn: () =>
      api.post(`/super-admin/barbershops/${form.barbershopId}/invoices`, {
        amount: Number(form.amount),
        discount: Number(form.discount || 0),
        dueDate: `${form.dueDate}T12:00:00.000Z`,
        notes: form.notes || undefined,
        couponCode: form.couponCode || undefined,
      }),
    onSuccess: async () => {
      toast.success('Fatura criada');
      setForm({
        barbershopId: '',
        amount: '',
        discount: '0',
        dueDate: defaultDueDate(),
        notes: '',
        couponCode: '',
      });
      setShowForm(false);
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const createCoupon = useMutation({
    mutationFn: () =>
      api.post('/super-admin/coupons', {
        ...couponForm,
        value: Number(couponForm.value),
        validUntil: couponForm.validUntil ? `${couponForm.validUntil}T23:59:59.999Z` : undefined,
        maxRedemptions: couponForm.maxRedemptions ? Number(couponForm.maxRedemptions) : undefined,
      }),
    onSuccess: async () => {
      toast.success('Cupom criado');
      setCouponForm({
        code: '',
        description: '',
        discountType: 'PERCENTAGE',
        value: '',
        validUntil: '',
        maxRedemptions: '',
      });
      setShowCouponForm(false);
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'coupons'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const toggleCoupon = useMutation({
    mutationFn: (coupon: Coupon) =>
      api.patch(`/super-admin/coupons/${coupon.id}`, { active: !coupon.active }),
    onSuccess: async () => {
      toast.success('Cupom atualizado');
      await queryClient.invalidateQueries({ queryKey: ['super-admin', 'coupons'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const payInvoice = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post(`/super-admin/invoices/${id}/payments`, { amount, method: 'PIX' }),
    onSuccess: async () => {
      toast.success('Pagamento registrado');
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const changeInvoice = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'cancel' | 'refund' }) =>
      api.post(`/super-admin/invoices/${id}/${action}`),
    onSuccess: async (_, variables) => {
      toast.success(variables.action === 'cancel' ? 'Fatura cancelada' : 'Fatura estornada');
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function remaining(invoice: Invoice) {
    const paid = invoice.payments
      .filter((payment) => payment.status === 'CONFIRMED')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    return Math.max(0, Number(invoice.total) - paid);
  }

  return (
    <section className="billing-module">
      <div className="module-head">
        <div>
          <span className="eyebrow">MÓDULO COMERCIAL</span>
          <h2>Pagamentos e faturas</h2>
          <p>Controle manual preparado para receber a integração com o gateway.</p>
        </div>
        <div className="module-actions">
          <button className="outline" onClick={() => setShowCouponForm((value) => !value)}>
            <TicketPercent /> Novo cupom
          </button>
          <button className="primary" onClick={() => setShowForm((value) => !value)}>
            <Plus /> Nova fatura
          </button>
        </div>
      </div>

      <div className="billing-summary">
        {(['PENDING', 'OVERDUE', 'PAID', 'REFUNDED'] as InvoiceStatus[]).map((key) => (
          <div className="card" key={key}>
            <small>{statusLabel[key].toUpperCase()}</small>
            <b>{data?.summary[key]?.count || 0}</b>
            <span>{money(data?.summary[key]?.total || 0)}</span>
          </div>
        ))}
      </div>

      {showCouponForm && (
        <form
          className="card coupon-form"
          onSubmit={(event) => {
            event.preventDefault();
            createCoupon.mutate();
          }}
        >
          <label>
            Código
            <input
              required
              minLength={3}
              maxLength={30}
              value={couponForm.code}
              onChange={(event) =>
                setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })
              }
            />
          </label>
          <label>
            Tipo
            <select
              value={couponForm.discountType}
              onChange={(event) =>
                setCouponForm({
                  ...couponForm,
                  discountType: event.target.value as 'PERCENTAGE' | 'FIXED',
                })
              }
            >
              <option value="PERCENTAGE">Percentual</option>
              <option value="FIXED">Valor fixo</option>
            </select>
          </label>
          <label>
            Valor
            <input
              required
              type="number"
              min="0.01"
              max={couponForm.discountType === 'PERCENTAGE' ? '100' : undefined}
              step="0.01"
              value={couponForm.value}
              onChange={(event) => setCouponForm({ ...couponForm, value: event.target.value })}
            />
          </label>
          <label>
            Válido até
            <input
              type="date"
              value={couponForm.validUntil}
              onChange={(event) => setCouponForm({ ...couponForm, validUntil: event.target.value })}
            />
          </label>
          <label>
            Limite de usos
            <input
              type="number"
              min="1"
              value={couponForm.maxRedemptions}
              onChange={(event) =>
                setCouponForm({ ...couponForm, maxRedemptions: event.target.value })
              }
            />
          </label>
          <label className="wide">
            Descrição
            <input
              value={couponForm.description}
              onChange={(event) =>
                setCouponForm({ ...couponForm, description: event.target.value })
              }
            />
          </label>
          <div className="billing-form-actions">
            <button type="button" className="outline" onClick={() => setShowCouponForm(false)}>
              Descartar
            </button>
            <button className="primary" disabled={createCoupon.isPending}>
              Criar cupom
            </button>
          </div>
        </form>
      )}

      {!!coupons.length && (
        <div className="coupon-list">
          {coupons.map((coupon) => (
            <div className={`card coupon-item ${coupon.active ? '' : 'inactive'}`} key={coupon.id}>
              <div>
                <b>{coupon.code}</b>
                <small>{coupon.description || 'Sem descrição'}</small>
              </div>
              <strong>
                {coupon.discountType === 'PERCENTAGE'
                  ? `${Number(coupon.value)}%`
                  : money(Number(coupon.value))}
              </strong>
              <span>
                {coupon._count.redemptions}
                {coupon.maxRedemptions ? `/${coupon.maxRedemptions}` : ''} usos
              </span>
              <button className="outline" onClick={() => toggleCoupon.mutate(coupon)}>
                {coupon.active ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <form
          className="card billing-form"
          onSubmit={(event) => {
            event.preventDefault();
            createInvoice.mutate();
          }}
        >
          <label>
            Barbearia
            <select
              required
              value={form.barbershopId}
              onChange={(event) => setForm({ ...form, barbershopId: event.target.value })}
            >
              <option value="">Selecione...</option>
              {tenants?.items.map((tenant) => (
                <option value={tenant.id} key={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Valor
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </label>
          <label>
            Desconto
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.discount}
              onChange={(event) => setForm({ ...form, discount: event.target.value })}
            />
          </label>
          <label>
            Vencimento
            <input
              required
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
            />
          </label>
          <label className="wide">
            Observação
            <input
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
          <label>
            Cupom
            <select
              value={form.couponCode}
              onChange={(event) => setForm({ ...form, couponCode: event.target.value })}
            >
              <option value="">Sem cupom</option>
              {coupons
                .filter((coupon) => coupon.active)
                .map((coupon) => (
                  <option value={coupon.code} key={coupon.id}>
                    {coupon.code}
                  </option>
                ))}
            </select>
          </label>
          <div className="billing-form-actions">
            <button type="button" className="outline" onClick={() => setShowForm(false)}>
              Descartar
            </button>
            <button className="primary" disabled={createInvoice.isPending}>
              Criar fatura
            </button>
          </div>
        </form>
      )}

      <div className="billing-filter">
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {Object.entries(statusLabel).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fatura</th>
              <th>Barbearia</th>
              <th>Vencimento</th>
              <th>Total</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <b>{invoice.number}</b>
                  {invoice.couponRedemption && (
                    <small className="invoice-coupon">
                      Cupom {invoice.couponRedemption.coupon.code}
                    </small>
                  )}
                </td>
                <td>{invoice.barbershop.name}</td>
                <td>{new Date(invoice.dueDate).toLocaleDateString('pt-BR')}</td>
                <td>{money(Number(invoice.total))}</td>
                <td>
                  <span className={`billing-status ${invoice.status.toLowerCase()}`}>
                    {statusLabel[invoice.status]}
                  </span>
                </td>
                <td className="billing-actions">
                  {(invoice.status === 'PENDING' || invoice.status === 'OVERDUE') && (
                    <>
                      <button
                        className="outline"
                        title="Registrar o saldo restante como PIX"
                        onClick={() =>
                          payInvoice.mutate({ id: invoice.id, amount: remaining(invoice) })
                        }
                      >
                        <CheckCircle2 /> Baixar via PIX
                      </button>
                      <button
                        className="outline danger"
                        onClick={() => changeInvoice.mutate({ id: invoice.id, action: 'cancel' })}
                      >
                        <XCircle /> Cancelar
                      </button>
                    </>
                  )}
                  {invoice.status === 'PAID' && (
                    <button
                      className="outline"
                      onClick={() => changeInvoice.mutate({ id: invoice.id, action: 'refund' })}
                    >
                      <RotateCcw /> Estornar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !data?.items.length && (
          <div className="empty">Nenhuma fatura encontrada.</div>
        )}
        {isLoading && <div className="empty">Carregando faturas...</div>}
      </div>
    </section>
  );
}
