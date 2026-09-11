import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Mail, Phone, Search, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

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

export function Employees() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [position, setPosition] = useState('');
  const [page, setPage] = useState(1);

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

  return (
    <div className="page employees-module">
      <div className="module-head">
        <div>
          <h2>Colaboradores</h2>
          <p>Consulte a equipe, os contatos e os acessos ao sistema.</p>
        </div>
        <span className="employee-total">{data?.total ?? 0} cadastrados</span>
      </div>

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
