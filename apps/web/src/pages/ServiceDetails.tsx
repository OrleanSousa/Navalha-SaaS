import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock3, Save, Scissors, UserRound, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

type Employee = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  defaultCommission: string | number;
};
type LinkRule = {
  id: string;
  employeeId: string;
  commissionPercent?: string | number | null;
  commissionFixed?: string | number | null;
  employee: Employee;
};
type Details = {
  service: {
    id: string;
    name: string;
    description?: string | null;
    price: string | number;
    durationMinutes: number;
    active: boolean;
    commissionPercent?: string | number | null;
    commissionFixed?: string | number | null;
    category?: { id: string; name: string } | null;
    employeeServices: LinkRule[];
  };
  employees: Employee[];
  commissionPriority: string[];
};

function commissionLabel(percent?: string | number | null, fixed?: string | number | null) {
  if (fixed != null) return `${money(Number(fixed))} fixos`;
  if (percent != null) return `${Number(percent).toLocaleString('pt-BR')}%`;
  return 'Sem regra própria';
}

function ProfessionalRule({
  serviceId,
  employee,
  link,
}: {
  serviceId: string;
  employee: Employee;
  link?: LinkRule;
}) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [type, setType] = useState(link?.commissionFixed != null ? 'FIXED' : 'PERCENT');
  const [value, setValue] = useState(
    String(link?.commissionFixed ?? link?.commissionPercent ?? ''),
  );
  const editable = can(Permissions.SERVICES_PROFESSIONALS);
  const save = useMutation({
    mutationFn: () =>
      api.post(`/services/${serviceId}/professionals/${employee.id}`, {
        commissionPercent: type === 'PERCENT' && value !== '' ? Number(value) : null,
        commissionFixed: type === 'FIXED' && value !== '' ? Number(value) : null,
      }),
    onSuccess: async () => {
      toast.success(link ? 'Comissão atualizada' : 'Profissional habilitado');
      await queryClient.invalidateQueries({ queryKey: ['service-details', serviceId] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível salvar o profissional'),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/services/${serviceId}/professionals/${employee.id}`),
    onSuccess: async () => {
      toast.success('Profissional removido do serviço');
      setValue('');
      await queryClient.invalidateQueries({ queryKey: ['service-details', serviceId] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível remover o profissional'),
  });

  return (
    <div className={`professional-rule ${link ? 'enabled' : ''}`}>
      <span
        className="professional-avatar"
        style={{ backgroundColor: `${employee.color}24`, color: employee.color }}
      >
        {employee.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="professional-name">
        <b>{employee.name}</b>
        <small>
          {employee.active ? 'Ativo' : 'Inativo'} · Padrão{' '}
          {Number(employee.defaultCommission).toLocaleString('pt-BR')}%
        </small>
      </div>
      {link ? (
        <>
          <select
            disabled={!editable}
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setValue('');
            }}
          >
            <option value="PERCENT">Percentual</option>
            <option value="FIXED">Valor fixo</option>
          </select>
          <input
            disabled={!editable}
            type="number"
            min="0"
            max={type === 'PERCENT' ? '100' : '99999999.99'}
            step="0.01"
            placeholder="Usar padrão"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {editable && (
            <button
              className="primary icon-btn"
              title="Salvar comissão"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              <Save />
            </button>
          )}
          {editable && (
            <button className="outline" disabled={remove.isPending} onClick={() => remove.mutate()}>
              Remover
            </button>
          )}
        </>
      ) : (
        <>
          <span className="professional-disabled">Não habilitado</span>
          {editable && (
            <button className="outline" disabled={save.isPending} onClick={() => save.mutate()}>
              Habilitar
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function ServiceDetails() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery<Details>({
    queryKey: ['service-details', id],
    queryFn: async () => (await api.get(`/services/${id}`)).data,
    enabled: Boolean(id),
  });
  if (isLoading) return <div className="empty big">Carregando serviço...</div>;
  if (isError || !data)
    return (
      <div className="empty big">
        <Scissors />
        <p>Não foi possível carregar o serviço.</p>
        <Link className="outline" to="/servicos">
          <ArrowLeft /> Voltar
        </Link>
      </div>
    );
  const { service } = data;
  return (
    <div className="page service-details-page">
      <Link className="employee-back" to="/servicos">
        <ArrowLeft /> Serviços
      </Link>
      <div className="service-profile card">
        <span>
          <Scissors />
        </span>
        <div>
          <small>{service.category?.name || 'Sem categoria'}</small>
          <h2>{service.name}</h2>
          <p>{service.description || 'Sem descrição cadastrada.'}</p>
        </div>
        <i className={service.active ? 'on' : 'off'}>{service.active ? 'ATIVO' : 'INATIVO'}</i>
      </div>
      <div className="service-detail-metrics">
        <div className="card">
          <b>{money(Number(service.price))}</b>
          <small>Preço</small>
        </div>
        <div className="card">
          <b>
            <Clock3 /> {service.durationMinutes} min
          </b>
          <small>Duração</small>
        </div>
        <div className="card">
          <b>{commissionLabel(service.commissionPercent, service.commissionFixed)}</b>
          <small>Comissão do serviço</small>
        </div>
        <div className="card">
          <b>
            <UsersRound /> {service.employeeServices.length}
          </b>
          <small>Profissionais habilitados</small>
        </div>
      </div>
      <section className="card commission-priority">
        <h3>Prioridade de comissão</h3>
        <p>Na finalização, a primeira regra configurada nesta ordem será aplicada.</p>
        <ol>
          {data.commissionPriority.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ol>
      </section>
      <section className="service-professionals">
        <div className="detail-section-head">
          <div>
            <h3>Profissionais habilitados</h3>
            <p>Defina quem executa o serviço e, se necessário, uma comissão específica.</p>
          </div>
        </div>
        {!data.employees.length ? (
          <div className="empty card">
            <UserRound /> Nenhum colaborador cadastrado.
          </div>
        ) : (
          data.employees.map((employee) => (
            <ProfessionalRule
              key={employee.id}
              serviceId={service.id}
              employee={employee}
              link={service.employeeServices.find((item) => item.employeeId === employee.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}
