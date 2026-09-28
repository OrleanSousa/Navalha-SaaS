import { useQuery } from '@tanstack/react-query';
import { Download, Printer, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { api, money } from '../lib/api';
import './Reports.css';

type Row = Record<string, any>;
type ReportData = {
  period: { start: string; end: string };
  overview: {
    revenue: number;
    financialIncome: number;
    expenses: number;
    balance: number;
    averageTicket: number;
    attendances: number;
    customers: number;
    commissions: number;
  };
  timeline: Array<{ date: string; label: string; revenue: number; expenses: number }>;
  employees: Array<{
    id: string;
    name: string;
    active: boolean;
    attendances: number;
    revenue: number;
    commission: number;
  }>;
  services: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  products: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    cost: number;
    margin: number;
  }>;
  customers: Array<{
    id: string;
    name: string;
    visits: number;
    spent: number;
    lastVisit?: string | null;
  }>;
  financial: {
    transactions: Array<{
      id: string;
      type: string;
      origin: string;
      category: string;
      description: string;
      amount: number;
      method?: string | null;
      paidAt?: string | null;
    }>;
    byCategory: Array<{ name: string; income: number; expense: number; balance: number }>;
    byMethod: Array<{ name: string; income: number; expense: number; balance: number }>;
  };
};
type Tab = 'overview' | 'financial' | 'services' | 'products' | 'employees' | 'customers';
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
  ACCOUNT_PAYABLE: 'Conta a pagar',
  ACCOUNT_RECEIVABLE: 'Conta a receber',
};

export function Reports() {
  const now = new Date();
  const [start, setStart] = useState(() => iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [end, setEnd] = useState(() => iso(now));
  const [tab, setTab] = useState<Tab>('overview');
  const { data, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ['reports', start, end],
    queryFn: async () => (await api.get('/reports', { params: { start, end } })).data,
    enabled: Boolean(start && end && start <= end),
  });
  function quickPeriod(period: 'TODAY' | '7D' | '30D' | 'MONTH') {
    const finish = new Date();
    const begin = new Date(finish);
    if (period === '7D') begin.setDate(begin.getDate() - 6);
    if (period === '30D') begin.setDate(begin.getDate() - 29);
    if (period === 'MONTH') begin.setDate(1);
    setStart(iso(begin));
    setEnd(iso(finish));
  }
  function exportCsv() {
    if (!data) return;
    const { filename, rows } = exportRows(tab, data);
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = `\uFEFF${headers.map(escape).join(';')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(';')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${start}-${end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="page reports-page">
      <div className="module-head">
        <div>
          <h2>Relatórios</h2>
          <p>Analise resultados reais por período e exporte os dados.</p>
        </div>
        <div className="report-export">
          <button className="outline" disabled={!data} onClick={exportCsv}>
            <Download /> Exportar CSV
          </button>
          <button className="outline" disabled={!data} onClick={() => window.print()}>
            <Printer /> Exportar PDF
          </button>
        </div>
      </div>
      <section className="card report-period">
        <div className="report-quick">
          <button onClick={() => quickPeriod('TODAY')}>Hoje</button>
          <button onClick={() => quickPeriod('7D')}>7 dias</button>
          <button onClick={() => quickPeriod('30D')}>30 dias</button>
          <button onClick={() => quickPeriod('MONTH')}>Este mês</button>
        </div>
        <label>
          De
          <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </section>
      <div className="report-tabs">
        {(
          [
            ['overview', 'Visão geral'],
            ['financial', 'Financeiro'],
            ['services', 'Serviços'],
            ['products', 'Produtos e margem'],
            ['employees', 'Colaboradores'],
            ['customers', 'Clientes'],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}>
            {label}
          </button>
        ))}
      </div>
      {isLoading && <div className="empty big">Calculando relatórios...</div>}
      {isError && (
        <div className="empty big">
          Não foi possível gerar os relatórios.
          <button className="outline" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {data && (
        <div className="report-print-area">
          <div className="report-print-title">
            <h2>
              Relatório — {start} a {end}
            </h2>
            <small>Gerado em {new Date().toLocaleString('pt-BR')}</small>
          </div>
          {tab === 'overview' && <Overview data={data} />}
          {tab === 'financial' && <Financial data={data} />}
          {tab === 'services' && (
            <Ranking
              title="Serviços mais vendidos"
              rows={data.services}
              columns={[
                ['name', 'Serviço'],
                ['quantity', 'Quantidade'],
                ['revenue', 'Faturamento'],
              ]}
              moneyFields={['revenue']}
            />
          )}
          {tab === 'products' && (
            <Ranking
              title="Produtos e margem"
              rows={data.products}
              columns={[
                ['name', 'Produto'],
                ['quantity', 'Quantidade'],
                ['revenue', 'Receita'],
                ['cost', 'Custo'],
                ['margin', 'Margem'],
              ]}
              moneyFields={['revenue', 'cost', 'margin']}
            />
          )}
          {tab === 'employees' && (
            <Ranking
              title="Desempenho dos colaboradores"
              rows={data.employees}
              columns={[
                ['name', 'Colaborador'],
                ['attendances', 'Atendimentos'],
                ['revenue', 'Faturamento'],
                ['commission', 'Comissão'],
              ]}
              moneyFields={['revenue', 'commission']}
            />
          )}
          {tab === 'customers' && (
            <Ranking
              title="Relatório de clientes"
              rows={data.customers}
              columns={[
                ['name', 'Cliente'],
                ['visits', 'Visitas'],
                ['spent', 'Total gasto'],
                ['lastVisit', 'Última visita'],
              ]}
              moneyFields={['spent']}
              dateFields={['lastVisit']}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Overview({ data }: { data: ReportData }) {
  const overview = data.overview;
  return (
    <>
      <div className="report-metrics">
        <ReportMetric label="Faturamento" value={money(overview.revenue)} />
        <ReportMetric label="Despesas" value={money(overview.expenses)} cls="expense" />
        <ReportMetric
          label="Saldo financeiro"
          value={money(overview.balance)}
          cls={overview.balance < 0 ? 'expense' : 'balance'}
        />
        <ReportMetric label="Ticket médio" value={money(overview.averageTicket)} />
        <ReportMetric label="Atendimentos" value={String(overview.attendances)} />
        <ReportMetric label="Clientes atendidos" value={String(overview.customers)} />
        <ReportMetric label="Comissões" value={money(overview.commissions)} />
      </div>
      <section className="card report-chart">
        <div className="card-head">
          <div>
            <span className="eyebrow">SÉRIE TEMPORAL</span>
            <h3>Faturamento e despesas</h3>
          </div>
          <TrendingUp />
        </div>
        <ResponsiveContainer width="100%" height={290}>
          <AreaChart data={data.timeline}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <Tooltip formatter={(value) => money(Number(value))} />
            <Legend />
            <Area name="Faturamento" dataKey="revenue" stroke="#4d8a5c" fill="#dcecdf" />
            <Area name="Despesas" dataKey="expenses" stroke="#a94e47" fill="#f3dddd" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
      <div className="report-rank-grid">
        <Ranking
          title="Ranking de colaboradores"
          rows={data.employees.slice(0, 5)}
          columns={[
            ['name', 'Colaborador'],
            ['attendances', 'Atendimentos'],
            ['revenue', 'Faturamento'],
          ]}
          moneyFields={['revenue']}
        />
        <Ranking
          title="Serviços mais vendidos"
          rows={data.services.slice(0, 5)}
          columns={[
            ['name', 'Serviço'],
            ['quantity', 'Quantidade'],
            ['revenue', 'Faturamento'],
          ]}
          moneyFields={['revenue']}
        />
        <Ranking
          title="Produtos mais vendidos"
          rows={data.products.slice(0, 5)}
          columns={[
            ['name', 'Produto'],
            ['quantity', 'Quantidade'],
            ['margin', 'Margem'],
          ]}
          moneyFields={['margin']}
        />
      </div>
    </>
  );
}
function Financial({ data }: { data: ReportData }) {
  return (
    <>
      <div className="report-rank-grid">
        <Ranking
          title="Por categoria"
          rows={data.financial.byCategory}
          columns={[
            ['name', 'Categoria'],
            ['income', 'Entradas'],
            ['expense', 'Saídas'],
            ['balance', 'Saldo'],
          ]}
          moneyFields={['income', 'expense', 'balance']}
        />
        <Ranking
          title="Por forma de pagamento"
          rows={data.financial.byMethod.map((row) => ({
            ...row,
            name: paymentLabels[row.name] || row.name,
          }))}
          columns={[
            ['name', 'Forma'],
            ['income', 'Entradas'],
            ['expense', 'Saídas'],
            ['balance', 'Saldo'],
          ]}
          moneyFields={['income', 'expense', 'balance']}
        />
      </div>
      <section className="card report-table">
        <div className="card-head">
          <div>
            <span className="eyebrow">MOVIMENTAÇÕES</span>
            <h3>Relatório financeiro</h3>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Origem</th>
                <th>Categoria</th>
                <th>Forma</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.financial.transactions.map((row) => (
                <tr key={row.id}>
                  <td>{row.paidAt ? new Date(row.paidAt).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{row.description}</td>
                  <td>{originLabels[row.origin] || row.origin}</td>
                  <td>{row.category}</td>
                  <td>{paymentLabels[row.method || 'OTHER']}</td>
                  <td className={row.type === 'INCOME' ? 'positive' : 'negative'}>
                    {row.type === 'INCOME' ? '+' : '−'} {money(row.amount)}
                  </td>
                </tr>
              ))}
              {!data.financial.transactions.length && (
                <tr>
                  <td colSpan={6} className="empty">
                    Nenhuma movimentação no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function ReportMetric({ label, value, cls = '' }: { label: string; value: string; cls?: string }) {
  return (
    <div className={`card report-metric ${cls}`}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}
function Ranking({
  title,
  rows,
  columns,
  moneyFields = [],
  dateFields = [],
}: {
  title: string;
  rows: Row[];
  columns: Array<[string, string]>;
  moneyFields?: string[];
  dateFields?: string[];
}) {
  const display = (row: Row, field: string) =>
    moneyFields.includes(field)
      ? money(Number(row[field] || 0))
      : dateFields.includes(field)
        ? row[field]
          ? new Date(row[field]).toLocaleDateString('pt-BR')
          : '—'
        : row[field];
  return (
    <section className="card report-table">
      <div className="card-head">
        <div>
          <span className="eyebrow">RELATÓRIO</span>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map(([field, label]) => (
                <th key={field}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id || `${row.name}-${index}`}>
                {columns.map(([field]) => (
                  <td key={field}>{display(row, field)}</td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="empty" colSpan={columns.length}>
                  Sem dados no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function exportRows(tab: Tab, data: ReportData): { filename: string; rows: Row[] } {
  if (tab === 'overview')
    return {
      filename: 'serie-temporal',
      rows: data.timeline.map((row) => ({
        Data: row.date,
        Faturamento: row.revenue,
        Despesas: row.expenses,
      })),
    };
  if (tab === 'financial')
    return {
      filename: 'financeiro',
      rows: data.financial.transactions.map((row) => ({
        Data: row.paidAt,
        Descricao: row.description,
        Tipo: row.type,
        Origem: originLabels[row.origin] || row.origin,
        Categoria: row.category,
        Forma: paymentLabels[row.method || 'OTHER'],
        Valor: row.amount,
      })),
    };
  if (tab === 'services') return { filename: 'servicos', rows: data.services };
  if (tab === 'products') return { filename: 'produtos-margem', rows: data.products };
  if (tab === 'employees') return { filename: 'colaboradores', rows: data.employees };
  return { filename: 'clientes', rows: data.customers };
}
