import { useQuery } from '@tanstack/react-query';
import { BadgeAlert, Building2, HandCoins, Percent, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { api, money } from '../lib/api';

type ReportRow = {
  barbershopId: string;
  barbershop: string;
  barbershopStatus: string;
  subscriptionStatus?: string;
  plan: string;
  invoices: number;
  billed: number;
  received: number;
  overdue: number;
  discounts: number;
};
type CommercialReport = {
  rows: ReportRow[];
  totals: {
    tenants: number;
    invoices: number;
    billed: number;
    received: number;
    overdue: number;
    discounts: number;
  };
};
type Plan = { id: string; name: string };

function monthStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function SuperReports() {
  const [filters, setFilters] = useState({
    startDate: monthStart(),
    endDate: today(),
    planId: '',
    subscriptionStatus: '',
    invoiceStatus: '',
  });
  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['super-admin', 'plans'],
    queryFn: async () => (await api.get('/super-admin/plans')).data,
  });
  const { data, isLoading, isError } = useQuery<CommercialReport>({
    queryKey: ['super-admin', 'commercial-report', filters],
    queryFn: async () =>
      (
        await api.get('/super-admin/commercial-report', {
          params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
        })
      ).data,
  });

  const update = (field: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [field]: value }));

  return (
    <section className="commercial-report">
      <div className="module-head">
        <div>
          <span className="eyebrow">ANÁLISE COMERCIAL</span>
          <h2>Relatório por tenant</h2>
          <p>Desempenho das assinaturas e cobranças no período selecionado.</p>
        </div>
      </div>

      <div className="report-filters">
        <label>
          Início
          <input
            type="date"
            value={filters.startDate}
            max={filters.endDate}
            onChange={(event) => update('startDate', event.target.value)}
          />
        </label>
        <label>
          Fim
          <input
            type="date"
            value={filters.endDate}
            min={filters.startDate}
            onChange={(event) => update('endDate', event.target.value)}
          />
        </label>
        <label>
          Plano
          <select value={filters.planId} onChange={(event) => update('planId', event.target.value)}>
            <option value="">Todos</option>
            {plans.map((plan) => (
              <option value={plan.id} key={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Assinatura
          <select
            value={filters.subscriptionStatus}
            onChange={(event) => update('subscriptionStatus', event.target.value)}
          >
            <option value="">Todas</option>
            <option value="TRIAL">Teste</option>
            <option value="ACTIVE">Ativa</option>
            <option value="PAST_DUE">Inadimplente</option>
            <option value="SUSPENDED">Suspensa</option>
            <option value="CANCELLED">Cancelada</option>
            <option value="EXPIRED">Expirada</option>
          </select>
        </label>
        <label>
          Fatura
          <select
            value={filters.invoiceStatus}
            onChange={(event) => update('invoiceStatus', event.target.value)}
          >
            <option value="">Todas</option>
            <option value="PENDING">Pendente</option>
            <option value="PAID">Paga</option>
            <option value="OVERDUE">Vencida</option>
            <option value="CANCELLED">Cancelada</option>
            <option value="REFUNDED">Estornada</option>
          </select>
        </label>
      </div>

      {isLoading && <div className="empty card">Gerando relatório...</div>}
      {isError && <div className="empty card">Não foi possível gerar o relatório.</div>}
      {data && (
        <>
          <div className="metrics report-metrics">
            <article className="metric">
              <span className="blue">
                <Building2 />
              </span>
              <div>
                <small>TENANTS</small>
                <b>{data.totals.tenants}</b>
                <em>{data.totals.invoices} faturas</em>
              </div>
            </article>
            <article className="metric">
              <span className="amber">
                <ReceiptText />
              </span>
              <div>
                <small>FATURADO</small>
                <b>{money(data.totals.billed)}</b>
                <em>No período</em>
              </div>
            </article>
            <article className="metric">
              <span className="green">
                <HandCoins />
              </span>
              <div>
                <small>RECEBIDO</small>
                <b>{money(data.totals.received)}</b>
                <em>Pagamentos confirmados</em>
              </div>
            </article>
            <article className="metric">
              <span className="red">
                <BadgeAlert />
              </span>
              <div>
                <small>VENCIDO</small>
                <b>{money(data.totals.overdue)}</b>
                <em>Em atraso</em>
              </div>
            </article>
            <article className="metric">
              <span className="purple">
                <Percent />
              </span>
              <div>
                <small>DESCONTOS</small>
                <b>{money(data.totals.discounts)}</b>
                <em>Concedidos</em>
              </div>
            </article>
          </div>

          <div className="card report-table">
            <table>
              <thead>
                <tr>
                  <th>Barbearia</th>
                  <th>Plano</th>
                  <th>Assinatura</th>
                  <th>Faturas</th>
                  <th>Faturado</th>
                  <th>Recebido</th>
                  <th>Vencido</th>
                  <th>Descontos</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.barbershopId}>
                    <td>
                      <b>{row.barbershop}</b>
                      <small>{row.barbershopStatus}</small>
                    </td>
                    <td>{row.plan}</td>
                    <td>
                      <span className="status confirmado">
                        {row.subscriptionStatus || 'SEM ASSINATURA'}
                      </span>
                    </td>
                    <td>{row.invoices}</td>
                    <td>{money(row.billed)}</td>
                    <td>{money(row.received)}</td>
                    <td className={row.overdue ? 'report-overdue' : ''}>{money(row.overdue)}</td>
                    <td>{money(row.discounts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.rows.length && (
              <div className="empty">Nenhum tenant encontrado para os filtros.</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
