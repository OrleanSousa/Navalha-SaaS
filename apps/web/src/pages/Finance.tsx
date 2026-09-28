import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  LockKeyhole,
  Pencil,
  Plus,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';
import './Finance.css';

type Transaction = {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  origin: 'MANUAL' | 'SALE' | 'COMMISSION';
  category: string;
  description: string;
  amount: number | string;
  method?: string | null;
  status: 'PAID' | 'CANCELLED';
  notes?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
};
type Summary = {
  openingBalance: number;
  income: number;
  expense: number;
  expectedBalance: number;
  methods: Record<string, { income: number; expense: number; net: number }>;
};
type Register = {
  id: string;
  openingBalance: number | string;
  closingBalance?: number | string | null;
  expectedBalance?: number | string | null;
  difference?: number | string | null;
  closingNotes?: string | null;
  openedAt: string;
  closedAt?: string | null;
  openedBy: { id: string; name: string };
  closedBy?: { id: string; name: string } | null;
  transactions: Transaction[];
  summary?: Summary;
};
type Overview = { register: Register | null; summary: Summary };
type HistoryResult = { items: Register[]; page: number; pages: number; total: number };
type TransactionForm = {
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description: string;
  amount: string;
  method: string;
  notes: string;
};

const emptyTransaction: TransactionForm = {
  type: 'INCOME',
  category: '',
  description: '',
  amount: '',
  method: 'PIX',
  notes: '',
};
const paymentLabels: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
  OTHER: 'Outro',
};
const originLabels: Record<string, string> = {
  MANUAL: 'Manual',
  SALE: 'Venda',
  COMMISSION: 'Comissão',
};
const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR');
const errorMessage = (error: any, fallback: string) => error.response?.data?.message || fallback;

export function Finance() {
  const { can } = useAuth();
  const client = useQueryClient();
  const [openingBalance, setOpeningBalance] = useState('');
  const [showTransaction, setShowTransaction] = useState(false);
  const [transactionForm, setTransactionForm] = useState<TransactionForm>(emptyTransaction);
  const [editing, setEditing] = useState<Transaction>();
  const [cancelling, setCancelling] = useState<Transaction>();
  const [cancelReason, setCancelReason] = useState('');
  const [showClose, setShowClose] = useState(false);
  const [closingBalance, setClosingBalance] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  const overview = useQuery<Overview>({
    queryKey: ['cash-register', 'current'],
    queryFn: async () => (await api.get('/cash-registers/current')).data,
  });
  const history = useQuery<HistoryResult>({
    queryKey: ['cash-registers', historyPage],
    queryFn: async () => (await api.get('/cash-registers', { params: { page: historyPage } })).data,
  });
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['cash-register'] }),
      client.invalidateQueries({ queryKey: ['cash-registers'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  }
  const openRegister = useMutation({
    mutationFn: () => api.post('/cash-registers', { openingBalance: Number(openingBalance) }),
    onSuccess: async () => {
      toast.success('Caixa aberto');
      setOpeningBalance('');
      await refresh();
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Não foi possível abrir o caixa')),
  });
  const saveTransaction = useMutation({
    mutationFn: () => {
      const payload = {
        ...transactionForm,
        amount: Number(transactionForm.amount),
        notes: transactionForm.notes || undefined,
      };
      return editing
        ? api.patch(`/financial-transactions/${editing.id}`, payload)
        : api.post(`/cash-registers/${overview.data!.register!.id}/transactions`, payload);
    },
    onSuccess: async () => {
      toast.success(editing ? 'Lançamento atualizado' : 'Lançamento registrado');
      setShowTransaction(false);
      setEditing(undefined);
      setTransactionForm(emptyTransaction);
      await refresh();
    },
    onError: (error: any) =>
      toast.error(errorMessage(error, 'Não foi possível salvar o lançamento')),
  });
  const cancelTransaction = useMutation({
    mutationFn: () =>
      api.post(`/financial-transactions/${cancelling!.id}/cancel`, { reason: cancelReason }),
    onSuccess: async () => {
      toast.success('Lançamento cancelado e auditado');
      setCancelling(undefined);
      setCancelReason('');
      await refresh();
    },
    onError: (error: any) =>
      toast.error(errorMessage(error, 'Não foi possível cancelar o lançamento')),
  });
  const closeRegister = useMutation({
    mutationFn: () =>
      api.post(`/cash-registers/${overview.data!.register!.id}/close`, {
        closingBalance: Number(closingBalance),
        notes: closingNotes || undefined,
      }),
    onSuccess: async () => {
      toast.success('Caixa fechado');
      setShowClose(false);
      setClosingBalance('');
      setClosingNotes('');
      await refresh();
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Não foi possível fechar o caixa')),
  });
  function submitTransaction(event: FormEvent) {
    event.preventDefault();
    saveTransaction.mutate();
  }
  function editTransaction(transaction: Transaction) {
    setEditing(transaction);
    setTransactionForm({
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      amount: String(transaction.amount),
      method: transaction.method || 'OTHER',
      notes: transaction.notes || '',
    });
    setShowTransaction(true);
  }
  function beginClose() {
    setClosingBalance(String(overview.data?.summary.expectedBalance ?? 0));
    setShowClose(true);
  }

  if (overview.isLoading) return <div className="empty big">Carregando caixa...</div>;
  if (overview.isError) {
    return (
      <div className="empty big">
        Não foi possível carregar o financeiro.
        <button className="outline" onClick={() => overview.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  }
  const register = overview.data?.register;
  const summary = overview.data?.summary;

  return (
    <div className="page finance-page">
      <div className="module-head">
        <div>
          <h2>Financeiro</h2>
          <p>Controle entradas, saídas, conferência e fechamento do caixa.</p>
        </div>
        <div className="finance-head-actions">
          {register && can(Permissions.FINANCIAL_TRANSACTIONS_MANAGE) && (
            <button className="primary" onClick={() => setShowTransaction(true)}>
              <Plus /> Novo lançamento
            </button>
          )}
          {register && can(Permissions.CASH_REGISTER_MANAGE) && (
            <button className="outline" onClick={beginClose}>
              <LockKeyhole /> Fechar caixa
            </button>
          )}
        </div>
      </div>

      {!register ? (
        <section className="card cash-empty">
          <Wallet />
          <div>
            <h3>Nenhum caixa aberto</h3>
            <p>Abra o caixa para receber vendas e registrar movimentações manuais.</p>
          </div>
          {can(Permissions.CASH_REGISTER_MANAGE) && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                openRegister.mutate();
              }}
            >
              <label>
                Saldo inicial
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                />
              </label>
              <button className="primary" disabled={openRegister.isPending}>
                Abrir caixa
              </button>
            </form>
          )}
        </section>
      ) : (
        <>
          <section className="cash-open-banner card">
            <span className="cash-pulse" />
            <div>
              <small>CAIXA ABERTO</small>
              <b>Desde {formatDate(register.openedAt)}</b>
            </div>
            <p>Aberto por {register.openedBy.name}</p>
          </section>
          <div className="finance-metrics">
            <Metric
              label="Saldo inicial"
              value={money(summary?.openingBalance || 0)}
              icon={<Wallet />}
            />
            <Metric
              label="Entradas"
              value={money(summary?.income || 0)}
              icon={<ArrowUpRight />}
              cls="positive"
            />
            <Metric
              label="Saídas"
              value={money(summary?.expense || 0)}
              icon={<ArrowDownLeft />}
              cls="negative"
            />
            <Metric
              label="Saldo esperado"
              value={money(summary?.expectedBalance || 0)}
              icon={<Wallet />}
              cls="expected"
            />
          </div>
          <section className="card payment-summary">
            <div className="card-head">
              <div>
                <span className="eyebrow">CONSOLIDAÇÃO</span>
                <h3>Por forma de pagamento</h3>
              </div>
            </div>
            <div className="payment-summary-grid">
              {Object.keys(summary?.methods || {}).length ? (
                Object.entries(summary!.methods).map(([method, values]) => (
                  <div key={method}>
                    <b>{paymentLabels[method] || method}</b>
                    <small>Entradas {money(values.income)}</small>
                    <small>Saídas {money(values.expense)}</small>
                    <strong>{money(values.net)}</strong>
                  </div>
                ))
              ) : (
                <p className="empty">Nenhuma movimentação neste caixa.</p>
              )}
            </div>
          </section>
          <TransactionTable
            transactions={register.transactions}
            editable={can(Permissions.FINANCIAL_TRANSACTIONS_MANAGE)}
            onEdit={editTransaction}
            onCancel={setCancelling}
          />
        </>
      )}

      {showTransaction && register && (
        <TransactionEditor
          form={transactionForm}
          setForm={setTransactionForm}
          editing={Boolean(editing)}
          pending={saveTransaction.isPending}
          onSubmit={submitTransaction}
          onCancel={() => {
            setShowTransaction(false);
            setEditing(undefined);
            setTransactionForm(emptyTransaction);
          }}
        />
      )}
      {cancelling && (
        <section className="card finance-action-form">
          <div>
            <h3>Cancelar lançamento</h3>
            <p>{cancelling.description}</p>
          </div>
          <label>
            Motivo do cancelamento
            <input
              required
              minLength={2}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </label>
          <div className="finance-form-actions">
            <button className="outline" onClick={() => setCancelling(undefined)}>
              Voltar
            </button>
            <button
              className="danger-button"
              disabled={cancelReason.trim().length < 2 || cancelTransaction.isPending}
              onClick={() => cancelTransaction.mutate()}
            >
              Confirmar cancelamento
            </button>
          </div>
        </section>
      )}
      {showClose && register && (
        <section className="card finance-action-form">
          <div>
            <h3>Fechar caixa</h3>
            <p>O saldo esperado é {money(summary?.expectedBalance || 0)}.</p>
          </div>
          <label>
            Saldo contado
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={closingBalance}
              onChange={(event) => setClosingBalance(event.target.value)}
            />
          </label>
          <label>
            Observação
            <input value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} />
          </label>
          <div className="finance-close-preview">
            Diferença:{' '}
            <b>{money(Number(closingBalance || 0) - Number(summary?.expectedBalance || 0))}</b>
          </div>
          <div className="finance-form-actions">
            <button className="outline" onClick={() => setShowClose(false)}>
              Voltar
            </button>
            <button
              className="primary"
              disabled={closingBalance === '' || closeRegister.isPending}
              onClick={() => closeRegister.mutate()}
            >
              Confirmar fechamento
            </button>
          </div>
        </section>
      )}

      <section className="card cash-history">
        <div className="card-head">
          <div>
            <span className="eyebrow">HISTÓRICO</span>
            <h3>Caixas anteriores</h3>
          </div>
          <History />
        </div>
        {history.isLoading ? (
          <p className="empty">Carregando histórico...</p>
        ) : history.isError ? (
          <p className="empty">Não foi possível carregar o histórico.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Abertura</th>
                  <th>Responsáveis</th>
                  <th>Saldo inicial</th>
                  <th>Esperado</th>
                  <th>Contado</th>
                  <th>Diferença</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.openedAt)}</td>
                    <td>
                      {item.openedBy.name}
                      {item.closedBy ? ` / ${item.closedBy.name}` : ''}
                    </td>
                    <td>{money(Number(item.openingBalance))}</td>
                    <td>
                      {item.expectedBalance == null ? '—' : money(Number(item.expectedBalance))}
                    </td>
                    <td>
                      {item.closingBalance == null ? '—' : money(Number(item.closingBalance))}
                    </td>
                    <td>{item.difference == null ? '—' : money(Number(item.difference))}</td>
                    <td>
                      <span className={`status ${item.closedAt ? 'cancelado' : 'confirmado'}`}>
                        {item.closedAt ? 'Fechado' : 'Aberto'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!history.data?.items.length && (
                  <tr>
                    <td colSpan={7} className="empty">
                      Nenhum caixa registrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {(history.data?.pages || 0) > 1 && (
          <div className="finance-pagination">
            <button
              className="outline"
              disabled={historyPage === 1}
              onClick={() => setHistoryPage((page) => page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {historyPage} de {history.data?.pages}
            </span>
            <button
              className="outline"
              disabled={historyPage === history.data?.pages}
              onClick={() => setHistoryPage((page) => page + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  cls = '',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  cls?: string;
}) {
  return (
    <div className={`card finance-metric ${cls}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}

function TransactionTable({
  transactions,
  editable,
  onEdit,
  onCancel,
}: {
  transactions: Transaction[];
  editable: boolean;
  onEdit: (item: Transaction) => void;
  onCancel: (item: Transaction) => void;
}) {
  return (
    <section className="card table-card finance-table">
      <div className="card-head">
        <div>
          <span className="eyebrow">MOVIMENTAÇÕES</span>
          <h3>Lançamentos do caixa</h3>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Origem</th>
              <th>Categoria</th>
              <th>Data</th>
              <th>Forma</th>
              <th>Status</th>
              <th>Valor</th>
              {editable && <th />}
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id} className={item.status === 'CANCELLED' ? 'cancelled-row' : ''}>
                <td>
                  <b>{item.description}</b>
                  {item.cancellationReason && <small>Motivo: {item.cancellationReason}</small>}
                </td>
                <td>{originLabels[item.origin]}</td>
                <td>{item.category}</td>
                <td>{formatDate(item.createdAt)}</td>
                <td>{paymentLabels[item.method || 'OTHER']}</td>
                <td>
                  <span className={`status ${item.status === 'PAID' ? 'confirmado' : 'cancelado'}`}>
                    {item.status === 'PAID' ? 'Pago' : 'Cancelado'}
                  </span>
                </td>
                <td className={item.type === 'INCOME' ? 'positive' : 'negative'}>
                  {item.type === 'INCOME' ? '+' : '−'} {money(Number(item.amount))}
                </td>
                {editable && (
                  <td>
                    {item.origin === 'MANUAL' && item.status === 'PAID' && (
                      <div className="row-actions">
                        <button className="icon" title="Editar" onClick={() => onEdit(item)}>
                          <Pencil />
                        </button>
                        <button className="icon" title="Cancelar" onClick={() => onCancel(item)}>
                          <RotateCcw />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!transactions.length && (
              <tr>
                <td colSpan={editable ? 8 : 7} className="empty">
                  Nenhum lançamento neste caixa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TransactionEditor({
  form,
  setForm,
  editing,
  pending,
  onSubmit,
  onCancel,
}: {
  form: TransactionForm;
  setForm: React.Dispatch<React.SetStateAction<TransactionForm>>;
  editing: boolean;
  pending: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const update = (field: keyof TransactionForm, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  return (
    <form className="card finance-transaction-form" onSubmit={onSubmit}>
      <div className="finance-form-title">
        <div>
          <h3>{editing ? 'Editar lançamento' : 'Novo lançamento'}</h3>
          <p>Registre somente movimentações efetivamente pagas.</p>
        </div>
      </div>
      <div className="finance-form-grid">
        <label>
          Tipo
          <select value={form.type} onChange={(event) => update('type', event.target.value)}>
            <option value="INCOME">Entrada</option>
            <option value="EXPENSE">Saída</option>
          </select>
        </label>
        <label>
          Categoria
          <input
            required
            minLength={2}
            maxLength={80}
            value={form.category}
            onChange={(event) => update('category', event.target.value)}
          />
        </label>
        <label className="wide">
          Descrição
          <input
            required
            minLength={2}
            maxLength={200}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
        </label>
        <label>
          Valor
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.amount}
            onChange={(event) => update('amount', event.target.value)}
          />
        </label>
        <label>
          Forma
          <select value={form.method} onChange={(event) => update('method', event.target.value)}>
            {Object.entries(paymentLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Observação
          <input
            maxLength={500}
            value={form.notes}
            onChange={(event) => update('notes', event.target.value)}
          />
        </label>
      </div>
      <div className="finance-form-actions">
        <button type="button" className="outline" onClick={onCancel}>
          Cancelar
        </button>
        <button className="primary" disabled={pending}>
          Salvar lançamento
        </button>
      </div>
    </form>
  );
}
