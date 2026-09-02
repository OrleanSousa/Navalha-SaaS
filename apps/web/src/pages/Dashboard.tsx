import { useQuery } from '@tanstack/react-query';
import { api, money } from '../lib/api';
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
const empty = {
  metrics: {
    todayRevenue: 0,
    monthRevenue: 0,
    todayAppointments: 0,
    todayCustomers: 0,
    cashBalance: 0,
    averageTicket: 0,
  },
  chart: [],
  appointments: [],
};
export function Dashboard() {
  const { data = empty } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const r = await api.get('/dashboard');
      return r.data;
    },
  });
  const m = data.metrics;
  return (
    <div className="page">
      <div className="welcome">
        <div>
          <h2>
            Bom dia, Administrador <span>✦</span>
          </h2>
          <p>Aqui está o resumo da sua barbearia hoje.</p>
        </div>
        <div className="date-pill">
          <CalendarCheck /> Terça, 01 de setembro
        </div>
      </div>
      <div className="metrics">
        <Metric
          icon={<Wallet />}
          label="Faturamento hoje"
          value={money(m.todayRevenue)}
          trend="12,5%"
          color="green"
        />
        <Metric
          icon={<TrendingUp />}
          label="Faturamento no mês"
          value={money(m.monthRevenue)}
          trend="8,2%"
          color="amber"
        />
        <Metric
          icon={<CalendarCheck />}
          label="Agendamentos hoje"
          value={String(m.todayAppointments).padStart(2, '0')}
          sub="6 confirmados"
          color="blue"
        />
        <Metric
          icon={<UsersRound />}
          label="Clientes atendidos"
          value={String(m.todayCustomers).padStart(2, '0')}
          sub={`Ticket médio ${money(m.averageTicket)}`}
          color="purple"
        />
      </div>
      <section className="quick">
        <b>AÇÕES RÁPIDAS</b>
        <div>
          <button>
            <span>
              <CalendarCheck />
            </span>
            <i>
              <strong>Novo agendamento</strong>
              <small>Reserve um horário</small>
            </i>
            <ChevronRight />
          </button>
          <button>
            <span>
              <UsersRound />
            </span>
            <i>
              <strong>Novo cliente</strong>
              <small>Cadastre rapidamente</small>
            </i>
            <ChevronRight />
          </button>
          <button>
            <span>
              <Scissors />
            </span>
            <i>
              <strong>Registrar venda</strong>
              <small>Serviço ou produto</small>
            </i>
            <ChevronRight />
          </button>
          <button>
            <span>
              <Plus />
            </span>
            <i>
              <strong>Lançar despesa</strong>
              <small>Controle seu caixa</small>
            </i>
            <ChevronRight />
          </button>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="card schedule">
          <div className="card-head">
            <div>
              <span className="eyebrow">PRÓXIMOS HORÁRIOS</span>
              <h3>Agenda de hoje</h3>
            </div>
            <button className="link">
              Ver agenda completa <ArrowUpRight />
            </button>
          </div>
          {data.appointments.map((a: any, i: number) => (
            <div className="appointment" key={i}>
              <div className="time">
                <b>{a.time}</b>
                <small>30 min</small>
              </div>
              <span className={`avatar c${i}`}>{a.customer.slice(0, 2).toUpperCase()}</span>
              <div className="person">
                <b>{a.customer}</b>
                <small>
                  {a.service} · {a.employee}
                </small>
              </div>
              <span className={`status ${a.status.toLowerCase()}`}>
                {a.status.replace('_', ' ')}
              </span>
              <button className="dots">•••</button>
            </div>
          ))}
        </section>
        <section className="card chart">
          <div className="card-head">
            <div>
              <span className="eyebrow">DESEMPENHO</span>
              <h3>Faturamento</h3>
            </div>
            <select>
              <option>Últimos 7 dias</option>
              <option>Últimos 30 dias</option>
            </select>
          </div>
          <div className="chart-total">
            <b>{money(23800)}</b>
            <span>↑ 14,2% no período</span>
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
              <Tooltip formatter={(v) => money(Number(v))} />
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
          <em>Caixa aberto</em>
        </div>
        <div className="card mini">
          <span>
            <Package />
          </span>
          <div>
            <small>ESTOQUE BAIXO</small>
            <b>3 produtos</b>
          </div>
          <a>Ver estoque →</a>
        </div>
        <div className="card mini">
          <span>
            <Clock3 />
          </span>
          <div>
            <small>COMISSÕES PENDENTES</small>
            <b>{money(1240)}</b>
          </div>
          <a>Ver detalhes →</a>
        </div>
      </div>
    </div>
  );
}
function Metric(p: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="metric">
      <span className={p.color}>{p.icon}</span>
      <div>
        <small>{p.label}</small>
        <b>{p.value}</b>
        <em>
          {p.trend && `↑ ${p.trend} `}
          {p.sub || 'vs. ontem'}
        </em>
      </div>
    </div>
  );
}
