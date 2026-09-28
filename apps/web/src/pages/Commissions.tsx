import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Banknote, CheckCircle2, Eye, Pencil, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';
import './Commissions.css';

type Employee = { id: string; name: string; color: string };
type Breakdown = {
  saleItemId: string;
  itemType: 'SERVICE' | 'PRODUCT';
  description: string;
  baseAmount: number;
  ruleType: 'FIXED' | 'PERCENT';
  ruleValue: number;
  source: 'PROFESSIONAL' | 'SERVICE' | 'PRODUCT' | 'EMPLOYEE';
  amount: number;
};
type Commission = {
  id: string;
  amount: string | number;
  percentage?: string | number | null;
  status: 'PENDING' | 'PAID';
  paidAt?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  calculation?: Breakdown[] | null;
  createdAt: string;
  employee: Employee;
  paidBy?: { id: string; name: string } | null;
  sale: {
    id: string;
    total: string | number;
    completedAt?: string | null;
    customer?: { id: string; name: string } | null;
    items: Array<{ id: string; description: string; quantity: number; total: string | number }>;
  };
};
type Result = {
  items: Commission[];
  employees: Employee[];
  summary: { sold: number; commission: number; attendances: number };
  page: number;
  pages: number;
  total: number;
};
const paymentLabels: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
  OTHER: 'Outro',
};
const sourceLabels: Record<string, string> = {
  PROFESSIONAL: 'Regra do profissional',
  SERVICE: 'Regra do serviço',
  PRODUCT: 'Regra do produto',
  EMPLOYEE: 'Padrão do profissional',
};
function dateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function Commissions() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [start, setStart] = useState(() =>
    dateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
  );
  const [end, setEnd] = useState(() => dateInput(now));
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Commission>();
  const [adjusting, setAdjusting] = useState<Commission>();
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [showPay, setShowPay] = useState(false);
  const [method, setMethod] = useState('PIX');
  const [notes, setNotes] = useState('');
  const { data, isLoading } = useQuery<Result>({
    queryKey: ['commissions', start, end, employeeId, status, page],
    queryFn: async () =>
      (
        await api.get('/commissions', {
          params: {
            start: `${start}T00:00:00.000`,
            end: `${end}T23:59:59.999`,
            employeeId: employeeId || undefined,
            status: status || undefined,
            page,
          },
        })
      ).data,
  });
  const pending = data?.items.filter((item) => item.status === 'PENDING') || [];
  const selectedItems = pending.filter((item) => selected.includes(item.id));
  const selectedTotal = selectedItems.reduce((sum, item) => sum + Number(item.amount), 0);
  async function refresh() {
    setSelected([]);
    await queryClient.invalidateQueries({ queryKey: ['commissions'] });
  }
  const adjust = useMutation({
    mutationFn: () =>
      api.patch(`/commissions/${adjusting!.id}`, {
        amount: Number(adjustAmount),
        reason: adjustReason,
      }),
    onSuccess: async () => {
      toast.success('Comissão ajustada e auditada');
      setAdjusting(undefined);
      setAdjustReason('');
      await refresh();
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível ajustar a comissão'),
  });
  const pay = useMutation({
    mutationFn: () =>
      api.post('/commissions/pay', { commissionIds: selected, method, notes: notes || undefined }),
    onSuccess: async () => {
      toast.success('Pagamento e saída financeira registrados');
      setShowPay(false);
      setNotes('');
      await refresh();
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível pagar as comissões'),
  });
  function openAdjustment(item: Commission) {
    setAdjusting(item);
    setAdjustAmount(String(item.amount));
    setAdjustReason('');
  }
  function toggleAll(checked: boolean) {
    setSelected(checked ? pending.map((item) => item.id) : []);
  }

  return (
    <div className="page commission-page">
      <div className="module-head">
        <div>
          <h2>Comissões</h2>
          <p>Acompanhe cálculo, pendências e pagamentos dos profissionais.</p>
        </div>
        {can(Permissions.COMMISSIONS_PAY) && selected.length > 0 && (
          <button className="primary" onClick={() => setShowPay(true)}>
            <Banknote /> Pagar selecionadas ({selected.length})
          </button>
        )}
      </div>
      <div className="commission-metrics">
        <div className="card">
          <BadgeDollarSign />
          <span>
            <small>Total vendido</small>
            <b>{money(data?.summary.sold || 0)}</b>
          </span>
        </div>
        <div className="card">
          <Banknote />
          <span>
            <small>Comissões no filtro</small>
            <b>{money(data?.summary.commission || 0)}</b>
          </span>
        </div>
        <div className="card">
          <UsersRound />
          <span>
            <small>Atendimentos</small>
            <b>{data?.summary.attendances || 0}</b>
          </span>
        </div>
      </div>
      <div className="card commission-filters">
        <label>
          De
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Profissional
          <select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {data?.employees.map((employee) => (
              <option value={employee.id} key={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Pago</option>
          </select>
        </label>
      </div>
      <div className="card table-card commission-table">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    pending.length > 0 && pending.every((item) => selected.includes(item.id))
                  }
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th>Profissional</th>
              <th>Venda</th>
              <th>Comissão</th>
              <th>Status</th>
              <th>Pagamento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="checkbox"
                    disabled={item.status !== 'PENDING'}
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, item.id]
                          : selected.filter((id) => id !== item.id),
                      )
                    }
                  />
                </td>
                <td>
                  <div className="commission-person">
                    <i style={{ background: item.employee.color }}>
                      {item.employee.name.slice(0, 2).toUpperCase()}
                    </i>
                    <span>
                      <b>{item.employee.name}</b>
                      <small>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</small>
                    </span>
                  </div>
                </td>
                <td>
                  <b>{money(Number(item.sale.total))}</b>
                  <small>
                    {item.sale.customer?.name || 'Consumidor'} · #{item.sale.id.slice(0, 8)}
                  </small>
                </td>
                <td>
                  <b>{money(Number(item.amount))}</b>
                  {item.percentage != null && (
                    <small>{Number(item.percentage).toLocaleString('pt-BR')}%</small>
                  )}
                </td>
                <td>
                  <em className={`status ${item.status.toLowerCase()}`}>
                    {item.status === 'PAID' ? 'Pago' : 'Pendente'}
                  </em>
                </td>
                <td>
                  {item.paidAt ? (
                    <>
                      <b>{new Date(item.paidAt).toLocaleDateString('pt-BR')}</b>
                      <small>
                        {paymentLabels[item.paymentMethod || ''] || item.paymentMethod} ·{' '}
                        {item.paidBy?.name}
                      </small>
                    </>
                  ) : (
                    <small>—</small>
                  )}
                </td>
                <td>
                  <div className="commission-actions">
                    <button className="icon" title="Ver cálculo" onClick={() => setDetail(item)}>
                      <Eye />
                    </button>
                    {item.status === 'PENDING' && can(Permissions.COMMISSIONS_UPDATE) && (
                      <button className="icon" title="Ajustar" onClick={() => openAdjustment(item)}>
                        <Pencil />
                      </button>
                    )}
                    {item.status === 'PENDING' && can(Permissions.COMMISSIONS_PAY) && (
                      <button
                        className="icon"
                        title="Pagar"
                        onClick={() => {
                          setSelected([item.id]);
                          setShowPay(true);
                        }}
                      >
                        <CheckCircle2 />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="empty">Carregando comissões...</div>}
        {!isLoading && !data?.items.length && (
          <div className="empty">Nenhuma comissão no período.</div>
        )}
        {data && data.pages > 1 && (
          <div className="customer-pagination">
            <span>
              Página {data.page} de {data.pages}
            </span>
            <button className="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <button
              className="outline"
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(undefined)}>
          <section className="card commission-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Memória de cálculo</h3>
            <p>
              Venda #{detail.sale.id.slice(0, 8)} · {detail.employee.name}
            </p>
            <div className="calculation-list">
              {detail.calculation?.map((line) => (
                <div key={line.saleItemId}>
                  <span>
                    <b>{line.description}</b>
                    <small>
                      {sourceLabels[line.source]} ·{' '}
                      {line.ruleType === 'FIXED' ? money(line.ruleValue) : `${line.ruleValue}%`}{' '}
                      sobre {money(line.baseAmount)}
                    </small>
                  </span>
                  <strong>{money(line.amount)}</strong>
                </div>
              )) || <div className="empty">Venda anterior sem detalhamento do cálculo.</div>}
            </div>
            <div className="modal-total">
              <span>Total</span>
              <b>{money(Number(detail.amount))}</b>
            </div>
            {detail.notes && <p className="commission-note">Observação: {detail.notes}</p>}
            <button className="outline" onClick={() => setDetail(undefined)}>
              Fechar
            </button>
          </section>
        </div>
      )}
      {adjusting && (
        <div className="modal-backdrop">
          <form
            className="card commission-modal"
            onSubmit={(e) => {
              e.preventDefault();
              adjust.mutate();
            }}
          >
            <h3>Ajustar comissão</h3>
            <p>
              {adjusting.employee.name} · valor atual {money(Number(adjusting.amount))}
            </p>
            <label>
              Novo valor
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </label>
            <label>
              Motivo do ajuste
              <input
                required
                minLength={2}
                maxLength={300}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </label>
            <div className="commission-modal-actions">
              <button type="button" className="outline" onClick={() => setAdjusting(undefined)}>
                Cancelar
              </button>
              <button className="primary" disabled={adjust.isPending}>
                Salvar ajuste
              </button>
            </div>
          </form>
        </div>
      )}
      {showPay && (
        <div className="modal-backdrop">
          <form
            className="card commission-modal"
            onSubmit={(e) => {
              e.preventDefault();
              pay.mutate();
            }}
          >
            <h3>Pagar comissões</h3>
            <p>
              {selected.length} comissão(ões) · total de <b>{money(selectedTotal)}</b>
            </p>
            <label>
              Forma de pagamento
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observação
              <textarea maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <small className="payment-warning">
              Uma saída financeira será criada automaticamente.
            </small>
            <div className="commission-modal-actions">
              <button type="button" className="outline" onClick={() => setShowPay(false)}>
                Cancelar
              </button>
              <button className="primary" disabled={!selected.length || pay.isPending}>
                Confirmar pagamento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
