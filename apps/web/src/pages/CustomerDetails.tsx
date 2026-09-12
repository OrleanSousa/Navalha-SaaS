import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, FileText, Mail, Phone, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api, money } from '../lib/api';

type CustomerDetailsResponse = {
  customer: {
    id: string;
    name: string;
    phone: string;
    whatsapp?: string | null;
    email?: string | null;
    cpf?: string | null;
    birthDate?: string | null;
    notes?: string | null;
    deletedAt?: string | null;
    createdAt: string;
  };
  serviceHistory: Array<{
    id: string;
    startAt: string;
    price: string | number;
    employee: { id: string; name: string };
    services: Array<{
      id: string;
      price: string | number;
      durationMinutes: number;
      service: { id: string; name: string };
    }>;
  }>;
};

function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(value),
      )
    : 'Não informado';
}

export function CustomerDetails() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery<CustomerDetailsResponse>({
    queryKey: ['customer-details', id],
    queryFn: async () => (await api.get(`/customers/${id}`)).data,
    enabled: Boolean(id),
  });

  if (isLoading) return <div className="empty big">Carregando cliente...</div>;
  if (isError || !data) {
    return (
      <div className="empty big">
        <UserRound />
        <p>Não foi possível carregar este cliente.</p>
        <Link className="outline" to="/clientes">
          <ArrowLeft /> Voltar
        </Link>
      </div>
    );
  }

  const { customer } = data;
  return (
    <div className="page customer-details-page">
      <Link className="employee-back" to="/clientes">
        <ArrowLeft /> Clientes
      </Link>
      <div className="customer-profile-head">
        <span>{customer.name.slice(0, 2).toUpperCase()}</span>
        <div>
          <div className="employee-profile-title">
            <h2>{customer.name}</h2>
            <span className={`employee-status ${customer.deletedAt ? '' : 'active'}`}>
              {customer.deletedAt ? 'Arquivado' : 'Ativo'}
            </span>
          </div>
          <p>Cliente desde {formatDate(customer.createdAt)}</p>
        </div>
      </div>

      <section className="customer-contact-band">
        <div>
          <Phone />
          <span>
            <small>Telefone</small>
            <b>{customer.phone}</b>
          </span>
        </div>
        <div>
          <Phone />
          <span>
            <small>WhatsApp</small>
            <b>{customer.whatsapp || 'Não informado'}</b>
          </span>
        </div>
        <div>
          <Mail />
          <span>
            <small>E-mail</small>
            <b>{customer.email || 'Não informado'}</b>
          </span>
        </div>
        <div>
          <UserRound />
          <span>
            <small>CPF</small>
            <b>{customer.cpf || 'Não informado'}</b>
          </span>
        </div>
        <div>
          <CalendarDays />
          <span>
            <small>Nascimento</small>
            <b>{formatDate(customer.birthDate)}</b>
          </span>
        </div>
      </section>

      <section className="customer-notes-band">
        <FileText />
        <div>
          <h3>Observações</h3>
          <p>{customer.notes || 'Nenhuma observação cadastrada.'}</p>
        </div>
      </section>

      <section className="employee-detail-section">
        <div className="detail-section-head">
          <div>
            <h3>Histórico de serviços</h3>
            <p>Atendimentos concluídos para este cliente.</p>
          </div>
          <span>{data.serviceHistory.length} atendimentos</span>
        </div>
        {!data.serviceHistory.length ? (
          <p className="detail-empty">Nenhum serviço concluído.</p>
        ) : (
          <div className="customer-history-table">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Serviços</th>
                  <th>Profissional</th>
                  <th>Duração</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.serviceHistory.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(appointment.startAt))}
                    </td>
                    <td>{appointment.services.map(({ service }) => service.name).join(', ')}</td>
                    <td>{appointment.employee.name}</td>
                    <td>
                      {appointment.services.reduce(
                        (total, item) => total + item.durationMinutes,
                        0,
                      )}{' '}
                      min
                    </td>
                    <td>{money(Number(appointment.price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
