import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal, Phone, Plus, Search } from 'lucide-react';
import { api, money } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Permissions } from '../lib/permissions';

export function Customers() {
  const { can } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await api.get('/customers')).data,
  });

  return (
    <div className="page">
      <div className="module-head">
        <div>
          <h2>Clientes</h2>
          <p>Gerencie seus clientes e acompanhe o histórico.</p>
        </div>
        {can(Permissions.CUSTOMERS_CREATE) && (
          <button className="primary">
            <Plus /> Novo cliente
          </button>
        )}
      </div>
      <div className="card table-card">
        <div className="table-tools">
          <label className="search">
            <Search />
            <input placeholder="Buscar por nome, telefone ou CPF..." />
          </label>
          <span>{data.length} clientes cadastrados</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contato</th>
              <th>Visitas</th>
              <th>Total gasto</th>
              <th>Último atendimento</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((customer: any) => (
              <tr key={customer.id}>
                <td>
                  <div className="customer">
                    <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                    <b>{customer.name}</b>
                  </div>
                </td>
                <td>
                  <small>
                    <Phone /> {customer.phone}
                  </small>
                </td>
                <td>{customer._count?.appointments || 0}</td>
                <td>{money(Number(customer.totalSpent || 0))}</td>
                <td>{customer.lastVisit ? '01/09/2026' : '—'}</td>
                <td>
                  <button className="icon">
                    <MoreHorizontal />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && (
          <div className="empty">
            Nenhum cliente encontrado. Execute o seed ou cadastre o primeiro cliente.
          </div>
        )}
      </div>
    </div>
  );
}
