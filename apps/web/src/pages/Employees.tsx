import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Save,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

type Employee = {
  id: string;
  name: string;
  photoUrl?: string | null;
  position?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  active: boolean;
  color: string;
  defaultCommission: string | number;
  user?: { email: string; active: boolean } | null;
  _count: { appointments: number; employeeServices: number };
};

type EmployeePage = {
  items: Employee[];
  page: number;
  limit: number;
  total: number;
  pages: number;
  positions: string[];
};

const emptyForm = {
  name: '',
  cpf: '',
  birthDate: '',
  phone: '',
  whatsapp: '',
  email: '',
  address: '',
  position: '',
  hiredAt: '',
  color: '#4F7CAC',
  defaultCommission: '0',
  notes: '',
};

export function Employees() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [position, setPosition] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => setPage(1), [search, status, position]);

  const { data, isLoading, isError } = useQuery<EmployeePage>({
    queryKey: ['employees', { search, status, position, page }],
    queryFn: async () =>
      (
        await api.get('/employees', {
          params: {
            page,
            limit: 10,
            search: search || undefined,
            status,
            position: position || undefined,
          },
        })
      ).data,
    placeholderData: (previous) => previous,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/employees', {
        ...Object.fromEntries(
          Object.entries(form).filter(
            ([key, value]) => key === 'color' || key === 'defaultCommission' || value,
          ),
        ),
        defaultCommission: Number(form.defaultCommission),
      }),
    onSuccess: async () => {
      toast.success('Colaborador cadastrado');
      setForm(emptyForm);
      setShowForm(false);
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.message || 'Não foi possível cadastrar o colaborador'),
  });

  return (
    <div className="page employees-module">
      <div className="module-head">
        <div>
          <h2>Colaboradores</h2>
          <p>Consulte a equipe, os contatos e os acessos ao sistema.</p>
        </div>
        <div className="employee-head-actions">
          <span className="employee-total">{data?.total ?? 0} cadastrados</span>
          {can(Permissions.EMPLOYEES_CREATE) && (
            <button className="primary" onClick={() => setShowForm(true)}>
              <Plus /> Novo colaborador
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form
          className="card employee-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <div className="employee-form-head">
            <div>
              <h3>Novo colaborador</h3>
              <p>Cadastre os dados profissionais e de contato.</p>
            </div>
            <button
              type="button"
              className="icon"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              title="Fechar formulário"
              aria-label="Fechar formulário"
            >
              <X />
            </button>
          </div>
          <div className="employee-form-grid">
            <label>
              Nome completo
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              Cargo
              <input
                value={form.position}
                onChange={(event) => setForm({ ...form, position: event.target.value })}
                maxLength={80}
              />
            </label>
            <label>
              CPF
              <input
                value={form.cpf}
                onChange={(event) => setForm({ ...form, cpf: event.target.value })}
                maxLength={20}
              />
            </label>
            <label>
              Data de nascimento
              <input
                type="date"
                value={form.birthDate}
                onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
              />
            </label>
            <label>
              Telefone
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                maxLength={30}
              />
            </label>
            <label>
              WhatsApp
              <input
                value={form.whatsapp}
                onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
                maxLength={30}
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                maxLength={160}
              />
            </label>
            <label>
              Data de contratação
              <input
                type="date"
                value={form.hiredAt}
                onChange={(event) => setForm({ ...form, hiredAt: event.target.value })}
              />
            </label>
            <label>
              Comissão padrão (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.defaultCommission}
                onChange={(event) => setForm({ ...form, defaultCommission: event.target.value })}
                required
              />
            </label>
            <label>
              Cor na agenda
              <span className="employee-color-input">
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) => setForm({ ...form, color: event.target.value })}
                />
                {form.color.toUpperCase()}
              </span>
            </label>
            <label className="wide">
              Endereço
              <input
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                maxLength={240}
              />
            </label>
            <label className="wide">
              Observações
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                maxLength={1000}
              />
            </label>
          </div>
          <div className="employee-form-actions">
            <button type="submit" className="primary" disabled={create.isPending}>
              <Save /> {create.isPending ? 'Salvando...' : 'Salvar colaborador'}
            </button>
          </div>
        </form>
      )}

      <div className="employee-filters">
        <label className="search">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, contato ou CPF..."
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Status"
        >
          <option value="ALL">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </select>
        <select
          value={position}
          onChange={(event) => setPosition(event.target.value)}
          aria-label="Cargo"
        >
          <option value="">Todos os cargos</option>
          {data?.positions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="card employee-table">
        {isLoading ? (
          <div className="empty">Carregando colaboradores...</div>
        ) : isError ? (
          <div className="empty">Não foi possível carregar os colaboradores.</div>
        ) : !data?.items.length ? (
          <div className="empty">Nenhum colaborador encontrado para os filtros selecionados.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Contato</th>
                <th>Atuação</th>
                <th>Comissão</th>
                <th>Acesso</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((employee) => (
                <tr key={employee.id}>
                  <td>
                    <div className="employee-person">
                      {employee.photoUrl ? (
                        <img src={employee.photoUrl} alt="" />
                      ) : (
                        <span
                          style={{ backgroundColor: `${employee.color}24`, color: employee.color }}
                        >
                          {employee.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <b>{employee.name}</b>
                        <small>{employee.position || 'Cargo não informado'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="employee-contact">
                      <small>
                        <Phone /> {employee.whatsapp || employee.phone || 'Não informado'}
                      </small>
                      <small>
                        <Mail /> {employee.email || employee.user?.email || 'Não informado'}
                      </small>
                    </div>
                  </td>
                  <td>{employee._count.employeeServices} serviços</td>
                  <td>{Number(employee.defaultCommission).toLocaleString('pt-BR')}%</td>
                  <td>
                    <span className={`access-state ${employee.user?.active ? 'enabled' : ''}`}>
                      <UserRound />{' '}
                      {employee.user
                        ? employee.user.active
                          ? 'Liberado'
                          : 'Bloqueado'
                        : 'Sem acesso'}
                    </span>
                  </td>
                  <td>
                    <span className={`employee-status ${employee.active ? 'active' : ''}`}>
                      {employee.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!!data?.total && (
          <div className="employee-pagination">
            <span>
              Página {data.page} de {Math.max(data.pages, 1)}
            </span>
            <div>
              <button
                className="icon outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={data.page <= 1}
                title="Página anterior"
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </button>
              <button
                className="icon outline"
                onClick={() => setPage((current) => current + 1)}
                disabled={data.page >= data.pages}
                title="Próxima página"
                aria-label="Próxima página"
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
