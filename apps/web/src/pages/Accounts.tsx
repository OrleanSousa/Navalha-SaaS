import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  UserRound,
  XCircle,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';
import './Accounts.css';

type AccountType = 'PAYABLE' | 'RECEIVABLE';
type Option = { id: string; name: string };
type Category = Option & { type: 'EXPENSE' | 'INCOME'; active?: boolean };
type Supplier = Option & {
  document?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active: boolean;
};
type Account = {
  id: string;
  description: string;
  documentNumber?: string | null;
  amount: number | string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  effectiveStatus: 'PENDING' | 'OVERDUE' | 'PAID' | 'CANCELLED';
  paymentMethod?: string | null;
  paidAt?: string | null;
  receivedAt?: string | null;
  supplier?: Option | null;
  customer?: Option | null;
  category?: Category | null;
  recurrenceId?: string | null;
};
type AccountResult = {
  items: Account[];
  summary: { pending: number; overdue: number; paid: number; cancelled: number };
  alerts: { overdue: number; dueSoon: number };
  page: number;
  pages: number;
  total: number;
};
type Options = { suppliers: Option[]; categories: Category[]; customers: Option[] };
type Recurrence = {
  id: string;
  description: string;
  amount: number | string;
  frequency: string;
  intervalCount: number;
  nextDueDate: string;
  active: boolean;
  supplier?: Option | null;
};
type AccountForm = {
  description: string;
  amount: string;
  dueDate: string;
  documentNumber: string;
  supplierId: string;
  customerId: string;
  categoryId: string;
  notes: string;
  recurring: boolean;
  frequency: string;
  intervalCount: string;
  endDate: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyAccount = (): AccountForm => ({
  description: '',
  amount: '',
  dueDate: today(),
  documentNumber: '',
  supplierId: '',
  customerId: '',
  categoryId: '',
  notes: '',
  recurring: false,
  frequency: 'MONTHLY',
  intervalCount: '1',
  endDate: '',
});
const paymentLabels: Record<string, string> = {
  CASH: 'Dinheiro',
  PIX: 'Pix',
  DEBIT_CARD: 'Cartão de débito',
  CREDIT_CARD: 'Cartão de crédito',
  OTHER: 'Outro',
};
const statusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  OVERDUE: 'Vencida',
  PAID: 'Paga',
  CANCELLED: 'Cancelada',
};
const frequencyLabels: Record<string, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  YEARLY: 'Anual',
};
const errorMessage = (error: any, fallback: string) => error.response?.data?.message || fallback;

export function Accounts() {
  const { can } = useAuth();
  const client = useQueryClient();
  const [type, setType] = useState<AccountType>('PAYABLE');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [relatedId, setRelatedId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AccountForm>(emptyAccount);
  const [settling, setSettling] = useState<Account>();
  const [settleMethod, setSettleMethod] = useState('PIX');
  const [settleNotes, setSettleNotes] = useState('');
  const [cancelling, setCancelling] = useState<Account>();
  const [cancelReason, setCancelReason] = useState('');
  const [showRegisters, setShowRegisters] = useState(false);

  useEffect(() => {
    setPage(1);
    setStatus('ALL');
    setCategoryId('');
    setRelatedId('');
    setShowForm(false);
  }, [type]);
  const options = useQuery<Options>({
    queryKey: ['accounts', 'options'],
    queryFn: async () => (await api.get('/accounts/options')).data,
  });
  const accounts = useQuery<AccountResult>({
    queryKey: ['accounts', type, page, status, search, categoryId, relatedId],
    queryFn: async () =>
      (
        await api.get(type === 'PAYABLE' ? '/accounts/payable' : '/accounts/receivable', {
          params: {
            page,
            status,
            search: search || undefined,
            categoryId: categoryId || undefined,
            supplierId: type === 'PAYABLE' ? relatedId || undefined : undefined,
            customerId: type === 'RECEIVABLE' ? relatedId || undefined : undefined,
          },
        })
      ).data,
  });
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['accounts'] }),
      client.invalidateQueries({ queryKey: ['cash-register'] }),
      client.invalidateQueries({ queryKey: ['cash-registers'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  }
  const createAccount = useMutation({
    mutationFn: async () => {
      const payload = {
        description: form.description,
        amount: Number(form.amount),
        dueDate: form.dueDate,
        documentNumber: form.documentNumber || undefined,
        categoryId: form.categoryId || undefined,
        supplierId: type === 'PAYABLE' ? form.supplierId || undefined : undefined,
        customerId: type === 'RECEIVABLE' ? form.customerId : undefined,
        notes: form.notes || undefined,
      };
      if (type === 'PAYABLE' && form.recurring) {
        return (
          await api.post('/expense-recurrences', {
            ...payload,
            frequency: form.frequency,
            intervalCount: Number(form.intervalCount),
            endDate: form.endDate || undefined,
          })
        ).data;
      }
      return (
        await api.post(type === 'PAYABLE' ? '/accounts/payable' : '/accounts/receivable', payload)
      ).data;
    },
    onSuccess: async () => {
      toast.success(form.recurring ? 'Despesa recorrente criada' : 'Conta criada');
      setShowForm(false);
      setForm(emptyAccount());
      await refresh();
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Não foi possível criar a conta')),
  });
  const settle = useMutation({
    mutationFn: () =>
      api.post(
        type === 'PAYABLE'
          ? `/accounts/payable/${settling!.id}/pay`
          : `/accounts/receivable/${settling!.id}/receive`,
        { method: settleMethod, notes: settleNotes || undefined },
      ),
    onSuccess: async () => {
      toast.success(type === 'PAYABLE' ? 'Pagamento registrado' : 'Recebimento registrado');
      setSettling(undefined);
      setSettleNotes('');
      await refresh();
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Não foi possível baixar a conta')),
  });
  const cancel = useMutation({
    mutationFn: () =>
      api.post(
        type === 'PAYABLE'
          ? `/accounts/payable/${cancelling!.id}/cancel`
          : `/accounts/receivable/${cancelling!.id}/cancel`,
        { reason: cancelReason },
      ),
    onSuccess: async () => {
      toast.success('Conta cancelada');
      setCancelling(undefined);
      setCancelReason('');
      await refresh();
    },
    onError: (error: any) => toast.error(errorMessage(error, 'Não foi possível cancelar a conta')),
  });
  const categories =
    options.data?.categories.filter((item) =>
      type === 'PAYABLE' ? item.type === 'EXPENSE' : item.type === 'INCOME',
    ) || [];
  const updateForm = (field: keyof AccountForm, value: string | boolean) =>
    setForm((current) => ({ ...current, [field]: value }));
  const submitAccount = (event: FormEvent) => {
    event.preventDefault();
    createAccount.mutate();
  };

  return (
    <div className="page accounts-page">
      <div className="module-head">
        <div>
          <h2>Contas</h2>
          <p>Controle compromissos, recebimentos, vencimentos e recorrências.</p>
        </div>
        <div className="accounts-head-actions">
          {can(Permissions.ACCOUNTS_MANAGE) && (
            <button className="outline" onClick={() => setShowRegisters((value) => !value)}>
              <Settings2 /> Cadastros
            </button>
          )}
          {can(Permissions.ACCOUNTS_MANAGE) && (
            <button className="primary" onClick={() => setShowForm(true)}>
              <Plus /> Nova conta
            </button>
          )}
        </div>
      </div>
      <div className="account-tabs">
        <button className={type === 'PAYABLE' ? 'active' : ''} onClick={() => setType('PAYABLE')}>
          Contas a pagar
        </button>
        <button
          className={type === 'RECEIVABLE' ? 'active' : ''}
          onClick={() => setType('RECEIVABLE')}
        >
          Contas a receber
        </button>
      </div>

      {accounts.data?.alerts.overdue || accounts.data?.alerts.dueSoon ? (
        <div className="account-alerts">
          {Boolean(accounts.data?.alerts.overdue) && (
            <span className="overdue">
              <AlertTriangle /> {accounts.data?.alerts.overdue} conta(s) vencida(s)
            </span>
          )}
          {Boolean(accounts.data?.alerts.dueSoon) && (
            <span>
              <CalendarClock /> {accounts.data?.alerts.dueSoon} vencendo nos próximos 7 dias
            </span>
          )}
        </div>
      ) : null}

      <div className="account-metrics">
        <Metric
          label="Pendente"
          value={money(accounts.data?.summary.pending || 0)}
          icon={<CalendarClock />}
        />
        <Metric
          label="Vencido"
          value={money(accounts.data?.summary.overdue || 0)}
          icon={<AlertTriangle />}
          cls="overdue"
        />
        <Metric
          label={type === 'PAYABLE' ? 'Pago' : 'Recebido'}
          value={money(accounts.data?.summary.paid || 0)}
          icon={<CheckCircle2 />}
          cls="paid"
        />
      </div>

      {showRegisters && <Registers onChanged={refresh} />}
      {showForm && (
        <form className="card account-form" onSubmit={submitAccount}>
          <div className="account-form-title">
            <div>
              <h3>{type === 'PAYABLE' ? 'Nova conta a pagar' : 'Nova conta a receber'}</h3>
              <p>O vencimento e o valor serão usados nos totais e alertas.</p>
            </div>
            <button type="button" className="icon" onClick={() => setShowForm(false)}>
              <XCircle />
            </button>
          </div>
          <div className="account-form-grid">
            <label className="wide">
              Descrição
              <input
                required
                minLength={2}
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
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
                onChange={(event) => updateForm('amount', event.target.value)}
              />
            </label>
            <label>
              Vencimento
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(event) => updateForm('dueDate', event.target.value)}
              />
            </label>
            <label>
              {type === 'PAYABLE' ? 'Fornecedor' : 'Cliente'}
              <select
                required={type === 'RECEIVABLE'}
                value={type === 'PAYABLE' ? form.supplierId : form.customerId}
                onChange={(event) =>
                  updateForm(type === 'PAYABLE' ? 'supplierId' : 'customerId', event.target.value)
                }
              >
                <option value="">Selecione</option>
                {(type === 'PAYABLE' ? options.data?.suppliers : options.data?.customers)?.map(
                  (item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Categoria
              <select
                value={form.categoryId}
                onChange={(event) => updateForm('categoryId', event.target.value)}
              >
                <option value="">Sem categoria</option>
                {categories.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Documento
              <input
                value={form.documentNumber}
                onChange={(event) => updateForm('documentNumber', event.target.value)}
              />
            </label>
            <label className="wide">
              Observação
              <input
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
              />
            </label>
            {type === 'PAYABLE' && (
              <label className="account-check">
                <input
                  type="checkbox"
                  checked={form.recurring}
                  onChange={(event) => updateForm('recurring', event.target.checked)}
                />{' '}
                Despesa recorrente
              </label>
            )}
            {type === 'PAYABLE' && form.recurring && (
              <>
                <label>
                  Frequência
                  <select
                    value={form.frequency}
                    onChange={(event) => updateForm('frequency', event.target.value)}
                  >
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensal</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                </label>
                <label>
                  Intervalo
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={form.intervalCount}
                    onChange={(event) => updateForm('intervalCount', event.target.value)}
                  />
                </label>
                <label>
                  Data final
                  <input
                    type="date"
                    min={form.dueDate}
                    value={form.endDate}
                    onChange={(event) => updateForm('endDate', event.target.value)}
                  />
                </label>
              </>
            )}
          </div>
          <div className="account-form-actions">
            <button type="button" className="outline" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
            <button className="primary" disabled={createAccount.isPending}>
              Salvar conta
            </button>
          </div>
        </form>
      )}

      <section className="card account-filters">
        <input
          placeholder="Buscar descrição ou documento"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">Todos os status</option>
          <option value="PENDING">Pendentes</option>
          <option value="OVERDUE">Vencidas</option>
          <option value="PAID">{type === 'PAYABLE' ? 'Pagas' : 'Recebidas'}</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
        <select
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as categorias</option>
          {categories.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={relatedId}
          onChange={(event) => {
            setRelatedId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">
            {type === 'PAYABLE' ? 'Todos os fornecedores' : 'Todos os clientes'}
          </option>
          {(type === 'PAYABLE' ? options.data?.suppliers : options.data?.customers)?.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </section>

      <section className="card table-card account-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>{type === 'PAYABLE' ? 'Fornecedor' : 'Cliente'}</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.data?.items.map((account) => (
                <tr key={account.id}>
                  <td>
                    <b>{account.description}</b>
                    {account.recurrenceId && (
                      <small>
                        <RefreshCw /> Recorrente
                      </small>
                    )}
                  </td>
                  <td>{account.supplier?.name || account.customer?.name || '—'}</td>
                  <td>{account.category?.name || '—'}</td>
                  <td>
                    {new Date(account.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </td>
                  <td>
                    <span className={`account-status ${account.effectiveStatus.toLowerCase()}`}>
                      {statusLabels[account.effectiveStatus]}
                    </span>
                  </td>
                  <td>{money(Number(account.amount))}</td>
                  <td>
                    {account.status === 'PENDING' && (
                      <div className="account-row-actions">
                        {can(Permissions.ACCOUNTS_SETTLE) && (
                          <button className="outline small" onClick={() => setSettling(account)}>
                            {type === 'PAYABLE' ? 'Pagar' : 'Receber'}
                          </button>
                        )}
                        {can(Permissions.ACCOUNTS_MANAGE) && (
                          <button
                            className="icon"
                            title="Cancelar"
                            onClick={() => setCancelling(account)}
                          >
                            <XCircle />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!accounts.isLoading && !accounts.data?.items.length && (
                <tr>
                  <td colSpan={7} className="empty">
                    Nenhuma conta encontrada.
                  </td>
                </tr>
              )}
              {accounts.isLoading && (
                <tr>
                  <td colSpan={7} className="empty">
                    Carregando contas...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {(accounts.data?.pages || 0) > 1 && (
          <div className="account-pagination">
            <button
              className="outline"
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {accounts.data?.pages}
            </span>
            <button
              className="outline"
              disabled={page === accounts.data?.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </section>

      {settling && (
        <ActionForm
          title={type === 'PAYABLE' ? 'Registrar pagamento' : 'Registrar recebimento'}
          description={`${settling.description} — ${money(Number(settling.amount))}`}
        >
          <label>
            Forma de pagamento
            <select value={settleMethod} onChange={(event) => setSettleMethod(event.target.value)}>
              {Object.entries(paymentLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observação
            <input value={settleNotes} onChange={(event) => setSettleNotes(event.target.value)} />
          </label>
          <div className="account-form-actions">
            <button className="outline" onClick={() => setSettling(undefined)}>
              Voltar
            </button>
            <button className="primary" disabled={settle.isPending} onClick={() => settle.mutate()}>
              Confirmar baixa
            </button>
          </div>
        </ActionForm>
      )}
      {cancelling && (
        <ActionForm title="Cancelar conta" description={cancelling.description}>
          <label className="wide">
            Motivo
            <input
              required
              minLength={2}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </label>
          <div className="account-form-actions">
            <button className="outline" onClick={() => setCancelling(undefined)}>
              Voltar
            </button>
            <button
              className="danger-button"
              disabled={cancelReason.trim().length < 2 || cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              Cancelar conta
            </button>
          </div>
        </ActionForm>
      )}
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
    <div className={`card account-metric ${cls}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}

function ActionForm({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card account-action-form">
      <div className="wide">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

function Registers({ onChanged }: { onChanged: () => Promise<void> }) {
  const client = useQueryClient();
  const [supplier, setSupplier] = useState({
    name: '',
    document: '',
    contactName: '',
    phone: '',
    email: '',
  });
  const [editingSupplier, setEditingSupplier] = useState<Supplier>();
  const [category, setCategory] = useState({ name: '', type: 'EXPENSE' });
  const [editingCategory, setEditingCategory] = useState<Category>();
  const suppliers = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: async () => (await api.get('/suppliers')).data,
  });
  const categories = useQuery<Category[]>({
    queryKey: ['financial-categories'],
    queryFn: async () => (await api.get('/financial-categories')).data,
  });
  const recurrences = useQuery<Recurrence[]>({
    queryKey: ['expense-recurrences'],
    queryFn: async () => (await api.get('/expense-recurrences')).data,
  });
  async function refreshRegisters() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['suppliers'] }),
      client.invalidateQueries({ queryKey: ['financial-categories'] }),
      client.invalidateQueries({ queryKey: ['expense-recurrences'] }),
      onChanged(),
    ]);
  }
  const saveSupplier = useMutation({
    mutationFn: () =>
      editingSupplier
        ? api.patch(`/suppliers/${editingSupplier.id}`, supplier)
        : api.post('/suppliers', supplier),
    onSuccess: async () => {
      toast.success('Fornecedor salvo');
      setSupplier({ name: '', document: '', contactName: '', phone: '', email: '' });
      setEditingSupplier(undefined);
      await refreshRegisters();
    },
    onError: (error: any) =>
      toast.error(errorMessage(error, 'Não foi possível salvar o fornecedor')),
  });
  const saveCategory = useMutation({
    mutationFn: () =>
      editingCategory
        ? api.patch(`/financial-categories/${editingCategory.id}`, category)
        : api.post('/financial-categories', category),
    onSuccess: async () => {
      toast.success('Categoria salva');
      setCategory({ name: '', type: 'EXPENSE' });
      setEditingCategory(undefined);
      await refreshRegisters();
    },
    onError: (error: any) =>
      toast.error(errorMessage(error, 'Não foi possível salvar a categoria')),
  });
  const toggle = useMutation({
    mutationFn: ({ resource, id, active }: { resource: string; id: string; active: boolean }) =>
      api.patch(`/${resource}/${id}/status`, { active }),
    onSuccess: refreshRegisters,
    onError: (error: any) => toast.error(errorMessage(error, 'Não foi possível alterar o status')),
  });
  return (
    <section className="account-registers">
      <div className="card register-card">
        <h3>Fornecedores</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveSupplier.mutate();
          }}
        >
          <input
            required
            minLength={2}
            placeholder="Nome"
            value={supplier.name}
            onChange={(event) => setSupplier({ ...supplier, name: event.target.value })}
          />
          <input
            placeholder="CPF/CNPJ"
            value={supplier.document}
            onChange={(event) => setSupplier({ ...supplier, document: event.target.value })}
          />
          <input
            placeholder="Contato"
            value={supplier.contactName}
            onChange={(event) => setSupplier({ ...supplier, contactName: event.target.value })}
          />
          <input
            placeholder="Telefone"
            value={supplier.phone}
            onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })}
          />
          <input
            type="email"
            placeholder="E-mail"
            value={supplier.email}
            onChange={(event) => setSupplier({ ...supplier, email: event.target.value })}
          />
          <button className="primary">{editingSupplier ? 'Atualizar' : 'Adicionar'}</button>
        </form>
        <div className="register-list">
          {suppliers.data?.map((item) => (
            <div key={item.id} className={!item.active ? 'inactive' : ''}>
              <UserRound />
              <span>
                <b>{item.name}</b>
                <small>{item.document || item.email || 'Sem documento'}</small>
              </span>
              <button
                className="icon"
                onClick={() => {
                  setEditingSupplier(item);
                  setSupplier({
                    name: item.name,
                    document: item.document || '',
                    contactName: item.contactName || '',
                    phone: item.phone || '',
                    email: item.email || '',
                  });
                }}
              >
                <Pencil />
              </button>
              <button
                className="outline small"
                onClick={() =>
                  toggle.mutate({ resource: 'suppliers', id: item.id, active: !item.active })
                }
              >
                {item.active ? 'Inativar' : 'Ativar'}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="card register-card">
        <h3>Categorias financeiras</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveCategory.mutate();
          }}
        >
          <input
            required
            minLength={2}
            placeholder="Nome"
            value={category.name}
            onChange={(event) => setCategory({ ...category, name: event.target.value })}
          />
          <select
            value={category.type}
            onChange={(event) => setCategory({ ...category, type: event.target.value })}
          >
            <option value="EXPENSE">Despesa</option>
            <option value="INCOME">Receita</option>
          </select>
          <button className="primary">{editingCategory ? 'Atualizar' : 'Adicionar'}</button>
        </form>
        <div className="register-list">
          {categories.data?.map((item) => (
            <div key={item.id} className={!item.active ? 'inactive' : ''}>
              <CircleDollarSign />
              <span>
                <b>{item.name}</b>
                <small>{item.type === 'EXPENSE' ? 'Despesa' : 'Receita'}</small>
              </span>
              <button
                className="icon"
                onClick={() => {
                  setEditingCategory(item);
                  setCategory({ name: item.name, type: item.type });
                }}
              >
                <Pencil />
              </button>
              <button
                className="outline small"
                onClick={() =>
                  toggle.mutate({
                    resource: 'financial-categories',
                    id: item.id,
                    active: !item.active,
                  })
                }
              >
                {item.active ? 'Inativar' : 'Ativar'}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="card register-card recurrence-card">
        <h3>Recorrências</h3>
        <div className="register-list">
          {recurrences.data?.map((item) => (
            <div key={item.id} className={!item.active ? 'inactive' : ''}>
              <RefreshCw />
              <span>
                <b>
                  {item.description} · {money(Number(item.amount))}
                </b>
                <small>
                  {frequencyLabels[item.frequency]} · próxima{' '}
                  {new Date(item.nextDueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                </small>
              </span>
              <button
                className="outline small"
                onClick={() =>
                  toggle.mutate({
                    resource: 'expense-recurrences',
                    id: item.id,
                    active: !item.active,
                  })
                }
              >
                {item.active ? 'Pausar' : 'Retomar'}
              </button>
            </div>
          ))}
          {!recurrences.data?.length && <p className="empty">Nenhuma recorrência criada.</p>}
        </div>
      </div>
    </section>
  );
}
