import { useQuery } from '@tanstack/react-query';
import {
  BadgeAlert,
  Building2,
  CircleDollarSign,
  Clock3,
  ReceiptText,
  UserMinus,
  Users,
} from 'lucide-react';
import { api, money } from '../lib/api';

type Dashboard = {
  metrics: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    users: number;
    employees: number;
    mrr: number;
    arr: number;
    averageTicket: number;
    paidRevenue: number;
    paidInvoices: number;
    churned: number;
    churnRate: number;
    overdueAmount: number;
    delinquencyRate: number;
  };
  planDistribution: Record<string, number>;
  recent: Array<{
    id: string;
    name: string;
    status: string;
    createdAt: string;
    subscription?: { plan: { name: string } };
  }>;
};

export function SuperOverview({ onShowTenants }: { onShowTenants(): void }) {
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: async () => (await api.get('/super-admin/dashboard')).data,
  });

  if (isLoading || !data) return <div className="empty card">Carregando indicadores...</div>;
  const metrics = data.metrics;

  return (
    <>
      <div className="module-head">
        <div>
          <h2>Visão geral da plataforma</h2>
          <p>Acompanhamento consolidado dos tenants e assinaturas.</p>
        </div>
      </div>
      <div className="metrics super-metrics">
        <article className="metric">
          <span className="amber">
            <Building2 />
          </span>
          <div>
            <small>TENANTS</small>
            <b>{metrics.total}</b>
            <em>{metrics.active} ativos</em>
          </div>
        </article>
        <article className="metric">
          <span className="blue">
            <Clock3 />
          </span>
          <div>
            <small>EM TESTE</small>
            <b>{metrics.trial}</b>
            <em>{metrics.suspended} suspensos</em>
          </div>
        </article>
        <article className="metric">
          <span className="green">
            <Users />
          </span>
          <div>
            <small>USUÁRIOS</small>
            <b>{metrics.users}</b>
            <em>{metrics.employees} colaboradores</em>
          </div>
        </article>
        <article className="metric">
          <span className="purple">
            <CircleDollarSign />
          </span>
          <div>
            <small>MRR ATUAL</small>
            <b>{money(metrics.mrr)}</b>
            <em>ARR de {money(metrics.arr)}</em>
          </div>
        </article>
      </div>
      <div className="metrics commercial-metrics">
        <article className="metric">
          <span className="green">
            <ReceiptText />
          </span>
          <div>
            <small>TICKET MÉDIO</small>
            <b>{money(metrics.averageTicket)}</b>
            <em>{metrics.paidInvoices} faturas pagas no mês</em>
          </div>
        </article>
        <article className="metric">
          <span className="amber">
            <UserMinus />
          </span>
          <div>
            <small>CHURN DO MÊS</small>
            <b>{metrics.churnRate.toLocaleString('pt-BR')}%</b>
            <em>{metrics.churned} cancelamentos</em>
          </div>
        </article>
        <article className="metric">
          <span className="red">
            <BadgeAlert />
          </span>
          <div>
            <small>INADIMPLÊNCIA</small>
            <b>{metrics.delinquencyRate.toLocaleString('pt-BR')}%</b>
            <em>{money(metrics.overdueAmount)} vencidos no mês</em>
          </div>
        </article>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <span className="eyebrow">CADASTROS RECENTES</span>
              <h3>Novas barbearias</h3>
            </div>
            <button className="link" onClick={onShowTenants}>
              Ver todas
            </button>
          </div>
          {data.recent.map((shop) => (
            <div className="appointment" key={shop.id}>
              <span className="avatar">{shop.name.slice(0, 2).toUpperCase()}</span>
              <div className="person">
                <b>{shop.name}</b>
                <small>{shop.subscription?.plan.name || 'Sem plano'}</small>
              </div>
              <span className="status confirmado">{shop.status}</span>
            </div>
          ))}
        </section>
        <section className="card plan-summary">
          <div className="card-head">
            <div>
              <span className="eyebrow">DISTRIBUIÇÃO</span>
              <h3>Assinaturas por plano</h3>
            </div>
          </div>
          {Object.entries(data.planDistribution).map(([plan, count]) => (
            <div className="plan-summary-row" key={plan}>
              <b>{plan}</b>
              <span>{count} assinatura(s)</span>
            </div>
          ))}
          {!Object.keys(data.planDistribution).length && (
            <div className="empty">Nenhuma assinatura ativa.</div>
          )}
        </section>
      </div>
    </>
  );
}
