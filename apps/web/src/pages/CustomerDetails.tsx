import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, FileText, Mail, Phone, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

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
    </div>
  );
}
