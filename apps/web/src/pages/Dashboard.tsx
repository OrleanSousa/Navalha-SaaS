import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  ArrowUpRight,
  CalendarCheck,
  ChevronRight,
  Clock3,
  Plus,
  Scissors,
  TrendingUp,
  UsersRound,
  Wallet,
  Package,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useState } from 'react';

type DashboardData = {
  barbershop: string;
  metrics: {
    todayRevenue: number;
    todayRevenueTrend: number;
    monthRevenue: number;
    monthRevenueTrend: number;
    todayAppointments: number;
    confirmedAppointments: number;
    todayCustomers: number;
    cashBalance: number;
    cashOpen: boolean;
    averageTicket: number;
    monthExpenses: number;
    pendingCommissions: number;
    lowStockProducts: number;
  };
  chart: Array<{ day: string; value: number }>;
  chartTotal: number;
  chartTrend: number;
  appointments: Array<{
    time: string;
    durationMinutes: number;
    customer: string;
    employee: string;
    service: string;
    status: string;
  }>;
};
const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_SERVICE: 'Em atendimento',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};
const trend = (value: number) => `${value >= 0 ? '↑' : '↓'} ${Math.abs(value).toFixed(1)}%`;

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', days],
    queryFn: async () => (await api.get('/dashboard', { params: { days } })).data,
  });
  if (isLoading) return <div className="empty big">Carregando indicadores...</div>;
  if (isError || !data) {
    return (
      <div className="empty big">
        Não foi possível carregar o dashboard.
        <button className="outline" onClick={() => refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  }
  const m = data.metrics;
  const now = new Date();
  const greeting =
    now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  return (
    <div className="page">
      <div className="welcome">
        <div>
          <h2>
            {greeting}, {user?.name || 'Administrador'} <span>✦</span>
          </h2>
          <p>
            Aqui está o resumo real de {data.barbershop || user?.barbershop || 'sua barbearia'}{' '}
            hoje.
          </p>
        </div>
        <div className="date-pill">
          <CalendarCheck />{' '}
          {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </div>
      </div>
      <div className="metrics">
        <Metric
          icon={<Wallet />}
          label="Faturamento hoje"
          value={money(m.todayRevenue)}
          trend={m.todayRevenueTrend}
          sub="vs. ontem"
          color="green"
        />
        <Metric
          icon={<TrendingUp />}
          label="Faturamento no mês"
          value={money(m.monthRevenue)}
          trend={m.monthRevenueTrend}
          sub="vs. mês anterior"
          color="amber"
        />
        <Metric
          icon={<CalendarCheck />}
          label="Agendamentos hoje"
          value={String(m.todayAppointments)}
          detail={`${m.confirmedAppointments} confirmados`}
          color="blue"
        />
        <Metric
          icon={<UsersRound />}
          label="Clientes atendidos"
          value={String(m.todayCustomers)}
          detail={`Ticket médio ${money(m.averageTicket)}`}
          color="purple"
        />
      </div>
      <section className="quick">
        <b>AÇÕES RÁPIDAS</b>
        <div>
          <Quick
            icon={<CalendarCheck />}
            title="Novo agendamento"
            subtitle="Reserve um horário"
            onClick={() => navigate('/agenda')}
          />
          <Quick
            icon={<UsersRound />}
            title="Novo cliente"
            subtitle="Cadastre rapidamente"
            onClick={() => navigate('/clientes')}
          />
          <Quick
            icon={<Scissors />}
            title="Registrar venda"
            subtitle="Serviço ou produto"
            onClick={() => navigate('/atendimentos')}
          />
          <Quick
            icon={<Plus />}
            title="Lançar despesa"
            subtitle="Controle suas contas"
            onClick={() => navigate('/contas')}
          />
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="card schedule">
          <div className="card-head">
            <div>
              <span className="eyebrow">PRÓXIMOS HORÁRIOS</span>
              <h3>Agenda de hoje</h3>
            </div>
            <button className="link" onClick={() => navigate('/agenda')}>
              Ver agenda completa <ArrowUpRight />
            </button>
          </div>
          {data.appointments.map((appointment, index) => (
            <div className="appointment" key={`${appointment.time}-${index}`}>
              <div className="time">
                <b>{appointment.time}</b>
                <small>{appointment.durationMinutes} min</small>
              </div>
              <span className={`avatar c${index}`}>
                {appointment.customer.slice(0, 2).toUpperCase()}
              </span>
              <div className="person">
                <b>{appointment.customer}</b>
                <small>
                  {appointment.service} · {appointment.employee}
                </small>
              </div>
              <span className={`status ${appointment.status.toLowerCase()}`}>
                {statusLabels[appointment.status] || appointment.status}
              </span>
            </div>
          ))}
          {!data.appointments.length && <p className="empty">Nenhum agendamento para hoje.</p>}
        </section>
        <section className="card chart">
          <div className="card-head">
            <div>
              <span className="eyebrow">DESEMPENHO</span>
              <h3>Faturamento</h3>
            </div>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
            </select>
          </div>
          <div className="chart-total">
            <b>{money(data.chartTotal)}</b>
            <span className={data.chartTrend < 0 ? 'negative' : ''}>
              {trend(data.chartTrend)} no período anterior
            </span>
          </div>
          <ResponsiveContainer width="100%" height={205}>
            <AreaChart data={data.chart}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c89635" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#c89635" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9e5dc" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#b98222"
                strokeWidth={3}
                fill="url(#fill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      </div>
      <div className="mini-grid">
        <div className="card mini">
          <span>
            <Wallet />
          </span>
          <div>
            <small>SALDO DO CAIXA</small>
            <b>{money(m.cashBalance)}</b>
          </div>
          <em>{m.cashOpen ? 'Caixa aberto' : 'Caixa fechado'}</em>
        </div>
        <div className="card mini">
          <span>
            <TrendingUp />
          </span>
          <div>
            <small>DESPESAS NO MÊS</small>
            <b>{money(m.monthExpenses)}</b>
          </div>
          <a onClick={() => navigate('/relatorios')}>Ver relatório →</a>
        </div>
        <div className="card mini">
          <span>
            <Package />
          </span>
          <div>
            <small>ESTOQUE BAIXO</small>
            <b>{m.lowStockProducts} produto(s)</b>
          </div>
          <a onClick={() => navigate('/produtos')}>Ver estoque →</a>
        </div>
        <div className="card mini">
          <span>
            <Clock3 />
          </span>
          <div>
            <small>COMISSÕES PENDENTES</small>
            <b>{money(m.pendingCommissions)}</b>
          </div>
          <a onClick={() => navigate('/comissoes')}>Ver detalhes →</a>
        </div>
      </div>
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  trend: change,
  detail,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: number;
  detail?: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="metric">
      <span className={color}>{icon}</span>
      <div>
        <small>{label}</small>
        <b>{value}</b>
        <em className={(change || 0) < 0 ? 'negative' : ''}>
          {change === undefined ? detail : `${trend(change)} ${sub}`}
        </em>
      </div>
    </div>
  );
}
function Quick({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}>
      <span>{icon}</span>
      <i>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </i>
      <ChevronRight />
    </button>
  );
}
