import { useQuery } from '@tanstack/react-query';
import {
  BadgeAlert,
  CircleDollarSign,
  HandCoins,
  Percent,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import { useState } from 'react';
import { api, money } from '../lib/api';

type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
type FinancialOverview = {
  period: { start: string; end: string };
  metrics: {
    mrr: number;
    arr: number;
    billedRevenue: number;
    realizedRevenue: number;
    outstandingAmount: number;
    overdueAmount: number;
    discounts: number;
  };
  status: Record<InvoiceStatus, { count: number; total: number }>;
  monthly: Array<{ key: string; label: string; billed: number; received: number }>;
};

const statusLabel: Record<InvoiceStatus, string> = {
  PENDING: 'Pendentes',
  PAID: 'Pagas',
  OVERDUE: 'Vencidas',
  CANCELLED: 'Canceladas',
  REFUNDED: 'Estornadas',
};

export function SuperFinance() {
  const [months, setMonths] = useState(6);
  const { data, isLoading, isError } = useQuery<FinancialOverview>({
    queryKey: ['super-admin', 'financial-overview', months],
    queryFn: async () =>
      (await api.get('/super-admin/financial-overview', { params: { months } })).data,
  });

  if (isLoading) return <div className="empty card">Carregando visão financeira...</div>;
  if (isError || !data)
    return <div className="empty card">Não foi possível carregar os dados.</div>;

  const metrics = data.metrics;
  const chartMax = Math.max(1, ...data.monthly.flatMap((month) => [month.billed, month.received]));

  return (
    <section className="super-finance">
      <div className="module-head">
        <div>
          <span className="eyebrow">RESULTADO CONSOLIDADO</span>
          <h2>Financeiro do SaaS</h2>
          <p>Receita, carteira e recorrência de todas as barbearias.</p>
        </div>
        <label className="period-select">
          Período
          <select value={months} onChange={(event) => setMonths(Number(event.target.value))}>
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
            <option value={24}>24 meses</option>
          </select>
        </label>
      </div>

      <div className="metrics finance-overview-metrics">
        <article className="metric">
          <span className="purple">
            <CircleDollarSign />
          </span>
          <div>
            <small>MRR</small>
            <b>{money(metrics.mrr)}</b>
            <em>ARR {money(metrics.arr)}</em>
          </div>
        </article>
        <article className="metric">
          <span className="blue">
            <ReceiptText />
          </span>
          <div>
            <small>FATURADO</small>
            <b>{money(metrics.billedRevenue)}</b>
            <em>No período</em>
          </div>
        </article>
        <article className="metric">
          <span className="green">
            <HandCoins />
          </span>
          <div>
            <small>RECEBIDO</small>
            <b>{money(metrics.realizedRevenue)}</b>
            <em>Pagamentos confirmados</em>
          </div>
        </article>
        <article className="metric">
          <span className="amber">
            <WalletCards />
          </span>
          <div>
            <small>EM ABERTO</small>
            <b>{money(metrics.outstandingAmount)}</b>
            <em>Pendente e vencido</em>
          </div>
        </article>
        <article className="metric">
          <span className="red">
            <BadgeAlert />
          </span>
          <div>
            <small>VENCIDO</small>
            <b>{money(metrics.overdueAmount)}</b>
            <em>Carteira em atraso</em>
          </div>
        </article>
        <article className="metric">
          <span className="amber">
            <Percent />
          </span>
          <div>
            <small>DESCONTOS</small>
            <b>{money(metrics.discounts)}</b>
            <em>Concedidos no período</em>
          </div>
        </article>
      </div>

      <div className="finance-overview-grid">
        <section className="card revenue-chart-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">EVOLUÇÃO MENSAL</span>
              <h3>Faturado e recebido</h3>
            </div>
            <div className="chart-legend">
              <span className="billed" /> Faturado <span className="received" /> Recebido
            </div>
          </div>
          <div className="revenue-bars">
            {data.monthly.map((month) => (
              <div className="revenue-month" key={month.key}>
                <div className="revenue-columns">
                  <span
                    className="billed"
                    style={{ height: `${(month.billed / chartMax) * 100}%` }}
                    title={`Faturado: ${money(month.billed)}`}
                  />
                  <span
                    className="received"
                    style={{ height: `${(month.received / chartMax) * 100}%` }}
                    title={`Recebido: ${money(month.received)}`}
                  />
                </div>
                <small>{month.label}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="card financial-status-card">
          <div className="card-head">
            <div>
              <span className="eyebrow">CARTEIRA</span>
              <h3>Faturas por status</h3>
            </div>
          </div>
          {(Object.keys(statusLabel) as InvoiceStatus[]).map((status) => (
            <div className="financial-status-row" key={status}>
              <span className={`billing-status ${status.toLowerCase()}`}>
                {statusLabel[status]}
              </span>
              <b>{data.status[status].count}</b>
              <strong>{money(data.status[status].total)}</strong>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
