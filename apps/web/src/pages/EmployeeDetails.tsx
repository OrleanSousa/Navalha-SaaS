import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarCheck,
  Clock3,
  Mail,
  MapPin,
  Percent,
  Phone,
  ReceiptText,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, assetUrl, money } from '../lib/api';

type Details = {
  employee: {
    id: string;
    name: string;
    cpf?: string | null;
    birthDate?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    photoUrl?: string | null;
    position?: string | null;
    hiredAt?: string | null;
    color: string;
    active: boolean;
    defaultCommission: string | number;
    notes?: string | null;
    user?: { email: string; role: string; active: boolean } | null;
    schedules: Array<{
      id: string;
      weekday: number;
      startTime: string;
      endTime: string;
      breakStart?: string | null;
      breakEnd?: string | null;
      active: boolean;
    }>;
    employeeServices: Array<{
      id: string;
      commissionPercent?: string | number | null;
      commissionFixed?: string | number | null;
      service: {
        id: string;
        name: string;
        price: string | number;
        durationMinutes: number;
        active: boolean;
      };
    }>;
  };
  metrics: {
    appointments: number;
    completedAppointments: number;
    sales: number;
    revenue: number;
    commissions: number;
  };
  appointments: Array<{
    id: string;
    startAt: string;
    status: string;
    price: string | number;
    customer: { name: string };
    services: Array<{ service: { name: string } }>;
  }>;
};

const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const statusLabels: Record<string, string> = {
  SCHEDULED: 'Agendado',
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em atendimento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};

function date(value?: string | null) {
  return value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : 'Não informado';
}

export function EmployeeDetails() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery<Details>({
    queryKey: ['employee-details', id],
    queryFn: async () => (await api.get(`/employees/${id}`)).data,
    enabled: Boolean(id),
  });

  if (isLoading) return <div className="empty big">Carregando colaborador...</div>;
  if (isError || !data) {
    return (
      <div className="empty big">
        <UserRound />
        <p>Não foi possível carregar este colaborador.</p>
        <Link className="outline" to="/colaboradores">
          <ArrowLeft /> Voltar
        </Link>
      </div>
    );
  }

  const { employee, metrics } = data;
  return (
    <div className="page employee-details-page">
      <Link className="employee-back" to="/colaboradores">
        <ArrowLeft /> Colaboradores
      </Link>

      <div className="employee-profile-head">
        {employee.photoUrl ? (
          <img src={assetUrl(employee.photoUrl)} alt="" />
        ) : (
          <span style={{ backgroundColor: `${employee.color}24`, color: employee.color }}>
            {employee.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div>
          <div className="employee-profile-title">
            <h2>{employee.name}</h2>
            <span className={`employee-status ${employee.active ? 'active' : ''}`}>
              {employee.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p>{employee.position || 'Cargo não informado'}</p>
        </div>
        <div className="employee-access-summary">
          <ShieldCheck />
          <span>
            <small>Acesso ao sistema</small>
            <b>
              {employee.user
                ? `${employee.user.role} · ${employee.user.active ? 'Ativo' : 'Bloqueado'}`
                : 'Não vinculado'}
            </b>
          </span>
        </div>
      </div>

      <div className="employee-detail-metrics">
        <div>
          <CalendarCheck />
          <span>
            <small>Agendamentos</small>
            <b>{metrics.appointments}</b>
          </span>
        </div>
        <div>
          <BriefcaseBusiness />
          <span>
            <small>Concluídos</small>
            <b>{metrics.completedAppointments}</b>
          </span>
        </div>
        <div>
          <ReceiptText />
          <span>
            <small>Vendas</small>
            <b>{metrics.sales}</b>
          </span>
        </div>
        <div>
          <WalletCards />
          <span>
            <small>Faturamento</small>
            <b>{money(metrics.revenue)}</b>
          </span>
        </div>
        <div>
          <Percent />
          <span>
            <small>Comissões</small>
            <b>{money(metrics.commissions)}</b>
          </span>
        </div>
      </div>

      <section className="employee-info-band">
        <div className="employee-info-main">
          <h3>Dados profissionais</h3>
          <dl>
            <div>
              <dt>
                <Phone /> Telefone
              </dt>
              <dd>{employee.whatsapp || employee.phone || 'Não informado'}</dd>
            </div>
            <div>
              <dt>
                <Mail /> E-mail
              </dt>
              <dd>{employee.email || employee.user?.email || 'Não informado'}</dd>
            </div>
            <div>
              <dt>
                <UserRound /> CPF
              </dt>
              <dd>{employee.cpf || 'Não informado'}</dd>
            </div>
            <div>
              <dt>
                <CalendarCheck /> Nascimento
              </dt>
              <dd>{date(employee.birthDate)}</dd>
            </div>
            <div>
              <dt>
                <BriefcaseBusiness /> Contratação
              </dt>
              <dd>{date(employee.hiredAt)}</dd>
            </div>
            <div>
              <dt>
                <Percent /> Comissão padrão
              </dt>
              <dd>{Number(employee.defaultCommission).toLocaleString('pt-BR')}%</dd>
            </div>
            <div className="wide">
              <dt>
                <MapPin /> Endereço
              </dt>
              <dd>{employee.address || 'Não informado'}</dd>
            </div>
          </dl>
        </div>
        <aside>
          <h3>Jornada semanal</h3>
          {!employee.schedules.length ? (
            <p className="detail-empty">Nenhuma jornada configurada.</p>
          ) : (
            employee.schedules.map((schedule) => (
              <div className="schedule-line" key={schedule.id}>
                <b>{weekdays[schedule.weekday]}</b>
                <span>
                  {schedule.startTime}–{schedule.endTime}
                </span>
                {schedule.breakStart && (
                  <small>
                    Pausa {schedule.breakStart}–{schedule.breakEnd}
                  </small>
                )}
              </div>
            ))
          )}
        </aside>
      </section>

      <section className="employee-detail-section">
        <div className="detail-section-head">
          <div>
            <h3>Serviços habilitados</h3>
            <p>Regras específicas de atuação e comissão.</p>
          </div>
          <span>{employee.employeeServices.length} serviços</span>
        </div>
        {!employee.employeeServices.length ? (
          <p className="detail-empty">Nenhum serviço vinculado.</p>
        ) : (
          <div className="employee-service-list">
            {employee.employeeServices.map((link) => (
              <div key={link.id}>
                <span>
                  <b>{link.service.name}</b>
                  <small>{link.service.durationMinutes} min</small>
                </span>
                <strong>{money(Number(link.service.price))}</strong>
                <em>
                  {link.commissionPercent
                    ? `${Number(link.commissionPercent).toLocaleString('pt-BR')}%`
                    : link.commissionFixed
                      ? money(Number(link.commissionFixed))
                      : 'Padrão'}
                </em>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="employee-detail-section">
        <div className="detail-section-head">
          <div>
            <h3>Atendimentos recentes</h3>
            <p>Últimos dez agendamentos registrados.</p>
          </div>
        </div>
        {!data.appointments.length ? (
          <p className="detail-empty">Nenhum atendimento registrado.</p>
        ) : (
          <div className="employee-appointment-table">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Serviços</th>
                  <th>Status</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      <span className="detail-date">
                        <Clock3 />
                        {new Intl.DateTimeFormat('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(appointment.startAt))}
                      </span>
                    </td>
                    <td>{appointment.customer.name}</td>
                    <td>{appointment.services.map(({ service }) => service.name).join(', ')}</td>
                    <td>
                      <span className="detail-status">
                        {statusLabels[appointment.status] || appointment.status}
                      </span>
                    </td>
                    <td>{money(Number(appointment.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {employee.notes && (
        <section className="employee-notes">
          <h3>Observações</h3>
          <p>{employee.notes}</p>
        </section>
      )}
    </div>
  );
}
