import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Printer, ReceiptText, Scissors, Trash2, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';
import './Attendances.css';

type Option = { id: string; name: string };
type SaleItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string | number;
  total: string | number;
  serviceId?: string | null;
  productId?: string | null;
};
type Sale = {
  id: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  subtotal: string | number;
  discount: string | number;
  discountReason?: string | null;
  total: string | number;
  createdAt: string;
  completedAt?: string | null;
  customer?: Option | null;
  employee?: Option | null;
  items: SaleItem[];
  payments: Array<{ id: string; method: string; amount: string | number }>;
};
type Options = {
  customers: Array<Option & { phone: string }>;
  employees: Option[];
  services: Array<Option & { price: string | number }>;
  products: Array<Option & { salePrice: string | number; stockQuantity: number }>;
  appointments: Array<{
    id: string;
    startAt: string;
    customer: { name: string };
    employee: { name: string };
  }>;
};
type Payment = { method: string; amount: string };
const paymentLabels: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'CartÃ£o de dÃ©bito',
  CREDIT_CARD: 'CartÃ£o de crÃ©dito',
  OTHER: 'Outro',
};

export function Attendances({ historyOnly = false }: { historyOnly?: boolean }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [appointmentId, setAppointmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [productId, setProductId] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [payments, setPayments] = useState<Payment[]>([{ method: 'PIX', amount: '' }]);

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: async () => (await api.get('/sales')).data,
  });
  const { data: options } = useQuery<Options>({
    queryKey: ['sale-options'],
    queryFn: async () => (await api.get('/sales/options')).data,
    enabled: !historyOnly,
  });
  const visibleSales = historyOnly ? sales.filter((sale) => sale.status === 'COMPLETED') : sales;
  const selected = sales.find((sale) => sale.id === selectedId);
  useEffect(() => {
    if (!selectedId && visibleSales.length) setSelectedId(visibleSales[0].id);
  }, [selectedId, visibleSales]);
  useEffect(() => {
    if (selected?.status === 'DRAFT') {
      setPayments([{ method: 'PIX', amount: Number(selected.total).toFixed(2) }]);
    }
  }, [selected?.id, selected?.status, selected?.total]);

  async function refresh(id?: string) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sales'] }),
      queryClient.invalidateQueries({ queryKey: ['sale-options'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    ]);
    if (id) setSelectedId(id);
  }
  const action = useMutation({
    mutationFn: async (request: () => Promise<any>) => (await request()).data as Sale,
    onSuccess: async (sale) => refresh(sale.id),
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o'),
  });
  const startAppointment = () =>
    action.mutate(() => api.post(`/sales/from-appointment/${appointmentId}`), {
      onSuccess: (sale) => {
        toast.success('Atendimento iniciado');
        setAppointmentId('');
        refresh(sale.id);
      },
    });
  const startWalkIn = () =>
    action.mutate(
      () => api.post('/sales/walk-in', { employeeId, customerId: customerId || null }),
      {
        onSuccess: (sale) => {
          toast.success('Atendimento avulso iniciado');
          setEmployeeId('');
          setCustomerId('');
          refresh(sale.id);
        },
      },
    );
  const finalize = () =>
    action.mutate(
      () =>
        api.post(`/sales/${selected!.id}/finalize`, {
          payments: payments.map((payment) => ({
            method: payment.method,
            amount: Number(payment.amount),
          })),
        }),
      {
        onSuccess: (sale) => {
          toast.success('Venda finalizada e lanÃ§amentos registrados');
          refresh(sale.id);
        },
      },
    );

  return (
    <div className="page attendance-page">
      <div className="module-head">
        <div>
          <h2>{historyOnly ? 'Vendas e comprovantes' : 'Atendimentos'}</h2>
          <p>
            {historyOnly
              ? 'Consulte pagamentos e imprima o resumo das vendas finalizadas.'
              : 'Monte a comanda, receba o pagamento e finalize em uma Ãºnica operaÃ§Ã£o.'}
          </p>
        </div>
      </div>

      {!historyOnly && can(Permissions.SALES_CREATE) && (
        <div className="sale-starters">
          <div className="card sale-starter">
            <Scissors />
            <div>
              <b>A partir da agenda</b>
              <small>Importa cliente, profissional e serviÃ§os.</small>
            </div>
            <select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
              <option value="">Selecione o agendamento</option>
              {options?.appointments.map((appointment) => (
                <option value={appointment.id} key={appointment.id}>
                  {new Date(appointment.startAt).toLocaleString('pt-BR')} â€”{' '}
                  {appointment.customer.name}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={!appointmentId || action.isPending}
              onClick={startAppointment}
            >
              Iniciar
            </button>
          </div>
          <div className="card sale-starter">
            <UserRound />
            <div>
              <b>Atendimento avulso</b>
              <small>Cliente Ã© opcional; profissional Ã© obrigatÃ³rio.</small>
            </div>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Profissional</option>
              {options?.employees.map((employee) => (
                <option value={employee.id} key={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Sem cliente</option>
              {options?.customers.map((customer) => (
                <option value={customer.id} key={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={!employeeId || action.isPending}
              onClick={startWalkIn}
            >
              Criar
            </button>
          </div>
        </div>
      )}

      <div className="sale-layout">
        <section className="card sale-list">
          <h3>{historyOnly ? 'HistÃ³rico' : 'Comandas recentes'}</h3>
          {isLoading && <div className="empty">Carregando...</div>}
          {!isLoading && !visibleSales.length && (
            <div className="empty">Nenhuma venda encontrada.</div>
          )}
          {visibleSales.map((sale) => (
            <button
              className={selectedId === sale.id ? 'sale-row active' : 'sale-row'}
              key={sale.id}
              onClick={() => setSelectedId(sale.id)}
            >
              <span>
                <b>{sale.customer?.name || 'Consumidor'}</b>
                <small>
                  {sale.employee?.name || 'Sem profissional'} Â·{' '}
                  {new Date(sale.createdAt).toLocaleString('pt-BR')}
                </small>
              </span>
              <span>
                <em className={`status ${sale.status.toLowerCase()}`}>
                  {sale.status === 'DRAFT' ? 'Em aberto' : 'Finalizada'}
                </em>
                <b>{money(Number(sale.total))}</b>
              </span>
            </button>
          ))}
        </section>

        <section className="card sale-detail">
          {!selected ? (
            <div className="empty">Selecione uma comanda.</div>
          ) : (
            <>
              <div className="sale-title">
                <div>
                  <h3>{selected.customer?.name || 'Consumidor nÃ£o identificado'}</h3>
                  <p>Profissional: {selected.employee?.name}</p>
                </div>
                <em className={`status ${selected.status.toLowerCase()}`}>
                  {selected.status === 'DRAFT' ? 'Em atendimento' : 'Venda finalizada'}
                </em>
              </div>

              {selected.status === 'DRAFT' && can(Permissions.SALES_UPDATE) && (
                <div className="sale-adders">
                  <label>
                    ServiÃ§o
                    <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                      <option value="">Selecione</option>
                      {options?.services.map((service) => (
                        <option value={service.id} key={service.id}>
                          {service.name} â€” {money(Number(service.price))}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="outline"
                    disabled={!serviceId || action.isPending}
                    onClick={() =>
                      action.mutate(
                        () =>
                          api.post(`/sales/${selected.id}/items/services`, {
                            serviceId,
                            quantity: 1,
                          }),
                        {
                          onSuccess: (sale) => {
                            setServiceId('');
                            refresh(sale.id);
                          },
                        },
                      )
                    }
                  >
                    <Plus /> Adicionar
                  </button>
                  <label>
                    Produto
                    <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                      <option value="">Selecione</option>
                      {options?.products.map((product) => (
                        <option value={product.id} key={product.id}>
                          {product.name} â€” {money(Number(product.salePrice))} (
                          {product.stockQuantity})
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="outline"
                    disabled={!productId || action.isPending}
                    onClick={() =>
                      action.mutate(
                        () =>
                          api.post(`/sales/${selected.id}/items/products`, {
                            productId,
                            quantity: 1,
                          }),
                        {
                          onSuccess: (sale) => {
                            setProductId('');
                            refresh(sale.id);
                          },
                        },
                      )
                    }
                  >
                    <Plus /> Adicionar
                  </button>
                </div>
              )}

              <div className="sale-items">
                {selected.items.map((item) => (
                  <div key={item.id}>
                    <span>
                      <b>{item.description}</b>
                      <small>
                        {item.quantity} Ã— {money(Number(item.unitPrice))}
                      </small>
                    </span>
                    <b>{money(Number(item.total))}</b>
                    {selected.status === 'DRAFT' && can(Permissions.SALES_UPDATE) && (
                      <button
                        className="icon danger"
                        title="Remover"
                        onClick={() =>
                          action.mutate(() => api.delete(`/sales/${selected.id}/items/${item.id}`))
                        }
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                ))}
                {!selected.items.length && (
                  <div className="empty">Adicione serviÃ§os ou produtos.</div>
                )}
              </div>

              <div className="sale-totals">
                <span>
                  Subtotal <b>{money(Number(selected.subtotal))}</b>
                </span>
                <span>
                  Desconto <b>- {money(Number(selected.discount))}</b>
                </span>
                <strong>
                  Total <b>{money(Number(selected.total))}</b>
                </strong>
              </div>

              {selected.status === 'DRAFT' && can(Permissions.SALES_DISCOUNT) && (
                <div className="discount-row">
                  <label>
                    Desconto
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </label>
                  <label>
                    Motivo
                    <input
                      minLength={2}
                      maxLength={300}
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                  </label>
                  <button
                    className="outline"
                    disabled={!discountReason || discount === '' || action.isPending}
                    onClick={() =>
                      action.mutate(
                        () =>
                          api.patch(`/sales/${selected.id}/discount`, {
                            amount: Number(discount),
                            reason: discountReason,
                          }),
                        {
                          onSuccess: (sale) => {
                            toast.success('Desconto aplicado');
                            refresh(sale.id);
                          },
                        },
                      )
                    }
                  >
                    Aplicar
                  </button>
                </div>
              )}

              {selected.status === 'DRAFT' && can(Permissions.SALES_FINALIZE) && (
                <div className="payment-box">
                  <div className="payment-head">
                    <div>
                      <h4>Pagamento</h4>
                      <small>A soma deve fechar exatamente o total.</small>
                    </div>
                    <button
                      className="outline"
                      onClick={() => setPayments([...payments, { method: 'CASH', amount: '' }])}
                    >
                      <Plus /> Dividir
                    </button>
                  </div>
                  {payments.map((payment, index) => (
                    <div className="payment-row" key={index}>
                      <select
                        value={payment.method}
                        onChange={(e) =>
                          setPayments(
                            payments.map((entry, i) =>
                              i === index ? { ...entry, method: e.target.value } : entry,
                            ),
                          )
                        }
                      >
                        {Object.entries(paymentLabels).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={payment.amount}
                        onChange={(e) =>
                          setPayments(
                            payments.map((entry, i) =>
                              i === index ? { ...entry, amount: e.target.value } : entry,
                            ),
                          )
                        }
                      />
                      {payments.length > 1 && (
                        <button
                          className="icon"
                          onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                        >
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="primary finalize"
                    disabled={
                      !selected.items.length ||
                      payments.some((payment) => !payment.amount) ||
                      action.isPending
                    }
                    onClick={finalize}
                  >
                    <CreditCard /> Finalizar venda
                  </button>
                </div>
              )}

              {selected.status === 'COMPLETED' && (
                <div className="receipt">
                  <div>
                    <ReceiptText />
                    <span>
                      <b>Comprovante da venda</b>
                      <small>
                        #{selected.id.slice(0, 8).toUpperCase()} Â·{' '}
                        {new Date(selected.completedAt || selected.createdAt).toLocaleString(
                          'pt-BR',
                        )}
                      </small>
                    </span>
                  </div>
                  {selected.payments.map((payment) => (
                    <span key={payment.id}>
                      {paymentLabels[payment.method] || payment.method}
                      <b>{money(Number(payment.amount))}</b>
                    </span>
                  ))}
                  <button className="outline" onClick={() => window.print()}>
                    <Printer /> Imprimir
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
